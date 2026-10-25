import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.expense import Expense
from app.models.receipt import Receipt
from app.models.flow import FinancialFlow, FlowHop
from app.schemas.flow import FinancialFlowCreate, FlowHopCreate
from app.services.flow_service import (
    create_financial_flow,
    ingest_flow_hop,
    link_expense_to_flow,
    reconcile_flow,
    reconstruct_timeline_impact_view,
    serialize_flow,
)
from app.api.v1.endpoints.flows import (
    list_financial_flows,
    get_flow_timeline,
    create_flow,
    ingest_hop,
    link_expense,
    reconcile_flow_endpoint,
    get_zk_proof_endpoint,
    get_impact_certificate_endpoint,
    ingest_passive_webhook_event,
)
from app.services.zk_attestation_service import verify_zk_offramp_attestation
from app.services.impact_certificate_service import (
    generate_impact_certificate,
    build_merkle_tree,
    handle_passive_webhook_event,
)
from app.schemas.flow import PassiveWebhookEvent

@pytest.fixture
def db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSession()

    # Preload sample project
    sample_proj = Project(
        id="PRJ-002",
        name="Clean Water for Bhairavpur",
        ngo="Jal Seva Collective",
        description="Community drinking water wells",
        budget=750000.0,
        raised=512000.0,
        location="Rajasthan",
        category="Clean water",
    )
    session.add(sample_proj)
    session.commit()

    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def admin_user():
    return User(
        id=1,
        email="admin@jalseva.org",
        full_name="Jal Seva Admin",
        role=UserRole.NGO_ADMIN.value,
        organization="Jal Seva Collective",
        is_active=True,
    )

@pytest.fixture
def donor_user():
    return User(
        id=2,
        email="donor@global.org",
        full_name="Aarav Mehta",
        role=UserRole.DONOR.value,
        organization="Independent Donor",
        is_active=True,
    )

def test_create_and_ingest_multihop_flow(db_session):
    # 1. Initialize flow
    flow_in = FinancialFlowCreate(
        projectId="PRJ-002",
        title="50 ETH Earmarked for Water Infrastructure",
        earmarkTag="Clean water infrastructure",
        sourceChain="Ethereum Mainnet (L1)",
        initialAsset="ETH",
        initialAmount=50.0,
        initialFiatEstimate=12500000.0,
        finalFiatAvailable=12450000.0,
    )
    flow = create_financial_flow(db_session, flow_in)
    assert flow.id.startswith("FLOW-")
    assert flow.remaining_fiat_amount == 12450000.0
    assert flow.disbursed_fiat_amount == 0.0

    # 2. Ingest Hop 1: Donation
    hop1 = ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=1,
            hopType="CRYPTO_DONATION",
            title="50 ETH Donation",
            fromEntity="0xDonor123",
            toEntity="0xTreasury456",
            inputAsset="ETH",
            inputAmount=50.0,
            outputAsset="ETH",
            outputAmount=50.0,
            exchangeRate=1.0,
            feeAmount=0.005,
            txHash="0xTxDonation111",
            chainNetwork="Ethereum L1",
        ),
    )
    assert hop1.hop_number == 1
    assert hop1.input_amount == 50.0

    # 3. Ingest Hop 2: DEX Swap to USDC
    hop2 = ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=2,
            hopType="DEX_SWAP",
            title="Uniswap Swap to USDC",
            fromEntity="0xTreasury456",
            toEntity="0xUniswapPool",
            inputAsset="ETH",
            inputAmount=50.0,
            outputAsset="USDC",
            outputAmount=150000.0,
            exchangeRate=3000.0,
            feeAmount=75.0,
            txHash="0xTxSwap222",
            chainNetwork="Ethereum L1",
        ),
    )
    assert hop2.output_amount == 150000.0

    # 4. Ingest Hop 3: Bridge to Polygon
    hop3 = ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=3,
            hopType="CROSS_CHAIN_BRIDGE",
            title="Stargate Bridge to Polygon",
            fromEntity="0xBridgeRouter",
            toEntity="0xPolygonTreasury",
            inputAsset="USDC",
            inputAmount=150000.0,
            outputAsset="USDC",
            outputAmount=149950.0,
            exchangeRate=1.0,
            feeAmount=50.0,
            txHash="0xTxBridge333",
            chainNetwork="Stargate Bridge",
        ),
    )
    assert hop3.output_amount == 149950.0

    # 5. Ingest Hop 4: Fiat Off-Ramp
    hop4 = ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=4,
            hopType="FIAT_OFFRAMP",
            title="Fiat Conversion to INR",
            fromEntity="0xPolygonTreasury",
            toEntity="NGO Bank Account",
            inputAsset="USDC",
            inputAmount=149950.0,
            outputAsset="INR",
            outputAmount=12450000.0,
            exchangeRate=83.02,
            feeAmount=10000.0,
            txHash="BANK-OFFRAMP-900",
            chainNetwork="Banking Wire",
        ),
    )
    assert hop4.output_amount == 12450000.0

    # Check reconciliation
    recon = reconcile_flow(db_session, flow.id)
    assert recon.isReconciled is True
    assert recon.hopCount == 4
    assert len(recon.anomaliesFound) == 0

def test_link_expense_and_detect_earmark_anomaly(db_session, admin_user):
    # Setup flow
    flow = create_financial_flow(
        db_session,
        FinancialFlowCreate(
            projectId="PRJ-002",
            title="Clean Water Fund",
            earmarkTag="Clean water infrastructure",
            initialAsset="ETH",
            initialAmount=10.0,
            initialFiatEstimate=2500000.0,
            finalFiatAvailable=2480000.0,
        ),
    )

    # Setup valid water expense
    exp_valid = Expense(
        id="EXP-WATER-1",
        project_id="PRJ-002",
        vendor="Rajasthan Pipe Works",
        category="Water infrastructure",
        invoice_number="INV-W1",
        claimed_amount=200000.0,
        receipt_name="pipe_receipt.pdf",
        receipt_hash="a" * 64,
        status="Approved",
        date="2026-10-22",
    )
    db_session.add(exp_valid)

    # Setup diverted expense (Office supplies)
    exp_diverted = Expense(
        id="EXP-OFFICE-2",
        project_id="PRJ-002",
        vendor="City Stationery",
        category="Office supplies",
        invoice_number="INV-O2",
        claimed_amount=50000.0,
        receipt_name="stationery.pdf",
        receipt_hash="b" * 64,
        status="Approved",
        date="2026-10-23",
    )
    db_session.add(exp_diverted)
    db_session.commit()

    # Link valid expense
    link_expense_to_flow(db_session, flow.id, "EXP-WATER-1")
    # Link diverted expense
    link_expense_to_flow(db_session, flow.id, "EXP-OFFICE-2")

    recon = reconcile_flow(db_session, flow.id)
    assert recon.isReconciled is False
    assert any(a.anomalyType == "EARMARK_MISMATCH" for a in recon.anomaliesFound)
    assert recon.totalDisbursedToVendors == 250000.0
    assert recon.remainingBalance == 2230000.0

def test_overdraw_anomaly_detection(db_session):
    flow = create_financial_flow(
        db_session,
        FinancialFlowCreate(
            projectId="PRJ-002",
            title="Small Water Grant",
            earmarkTag="Water",
            initialAsset="ETH",
            initialAmount=1.0,
            initialFiatEstimate=250000.0,
            finalFiatAvailable=240000.0,
        ),
    )
    # Manually ingest a disbursement larger than available
    ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=1,
            hopType="VENDOR_DISBURSEMENT",
            title="Overdrawn Vendor Payment",
            fromEntity="NGO Treasury",
            toEntity="Overpaid Vendor",
            inputAsset="INR",
            inputAmount=300000.0,
            outputAsset="INR",
            outputAmount=300000.0,
            exchangeRate=1.0,
            feeAmount=0.0,
            txHash="WIRE-OVER-1",
            chainNetwork="Banking Wire",
            linkedReceiptHash="c" * 64,
        ),
    )
    recon = reconcile_flow(db_session, flow.id)
    assert recon.isReconciled is False
    assert any(a.anomalyType == "OVERDRAW" for a in recon.anomaliesFound)

def test_flow_api_endpoints(db_session, admin_user, donor_user):
    # 1. Create Flow via POST /flows
    flow_payload = FinancialFlowCreate(
        projectId="PRJ-002",
        title="Bhairavpur 50 ETH Pipeline",
        earmarkTag="Clean water infrastructure",
        initialAsset="ETH",
        initialAmount=50.0,
        initialFiatEstimate=12500000.0,
        finalFiatAvailable=12450000.0,
    )
    created = create_flow(flow_payload, db=db_session, current_user=admin_user)
    assert created.id.startswith("FLOW-")

    # 2. Ingest hop via POST /flows/{id}/hops
    hop_payload = FlowHopCreate(
        hopNumber=1,
        hopType="CRYPTO_DONATION",
        title="50 ETH L1 Ingestion",
        fromEntity="0xDonor",
        toEntity="0xTreasury",
        inputAsset="ETH",
        inputAmount=50.0,
        outputAsset="ETH",
        outputAmount=50.0,
        txHash="0xTxTest",
        chainNetwork="Ethereum L1",
    )
    hop = ingest_hop(created.id, hop_payload, db=db_session, current_user=admin_user)
    assert hop.hopNumber == 1

    # 3. List flows via GET /flows
    all_flows = list_financial_flows(db=db_session, current_user=donor_user)
    assert len(all_flows) >= 1

    # 4. Get timeline via GET /flows/{id}
    timeline = get_flow_timeline(created.id, db=db_session, current_user=donor_user)
    assert len(timeline.milestones) == 1
    assert timeline.reconciliation.isReconciled is True

def test_zktls_attestation_proof_privacy(db_session, admin_user, donor_user):
    # Setup flow with offramp hop
    flow = create_financial_flow(
        db_session,
        FinancialFlowCreate(
            projectId="PRJ-002",
            title="Privacy Guard Test Flow",
            earmarkTag="Clean water infrastructure",
            initialAsset="ETH",
            initialAmount=50.0,
            initialFiatEstimate=12500000.0,
            finalFiatAvailable=12450000.0,
        ),
    )
    # Ingest Fiat Off-Ramp hop
    ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=1,
            hopType="FIAT_OFFRAMP",
            title="Fiat Off-Ramp via Regulated Wire",
            fromEntity="Polygon L2 Treasury: 0x3d9...1a",
            toEntity="Jal Seva Collective Bank Treasury Account",
            inputAsset="USDC",
            inputAmount=149950.0,
            outputAsset="INR",
            outputAmount=12450000.0,
            exchangeRate=83.02,
            feeAmount=12000.0,
            txHash="BANK-OR-9921",
            chainNetwork="Regulated Gateway / Direct Bank Wire",
            status="CONFIRMED",
        ),
    )

    # Call ZK Proof verification endpoint
    proof = get_zk_proof_endpoint(
        flow_id=flow.id,
        hop_number=1,
        db=db_session,
        current_user=donor_user,
    )

    assert proof.flowId == flow.id
    assert proof.hopNumber == 1
    assert proof.proofType == "ZKTLS_MPC_NOTARY_PROOF"
    assert proof.isValid is True
    assert proof.merkleCommitment.startswith("0x")
    assert "beneficiary_personal_identities" in proof.redactedFields
    assert "vendor_bank_account_numbers" in proof.redactedFields
    assert proof.verifiedAttributes["piiExposure"] == "ZERO_PII_LEAKED"
    assert proof.verifiedAttributes["outputAmount"] == 12450000.0

def test_merkle_impact_certificate_generation(db_session, donor_user):
    # Setup flow with 2 hops and receipt
    flow = create_financial_flow(
        db_session,
        FinancialFlowCreate(
            projectId="PRJ-002",
            title="Clean Water Merkle Impact Flow",
            earmarkTag="Clean water infrastructure",
            initialAsset="ETH",
            initialAmount=50.0,
            initialFiatEstimate=12500000.0,
            finalFiatAvailable=12450000.0,
        ),
    )
    # Hop 1: Donation
    ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=1,
            hopType="CRYPTO_DONATION",
            title="50 ETH Donation",
            fromEntity="0xDonorWallet",
            toEntity="0xNGOTreasury",
            inputAsset="ETH",
            inputAmount=50.0,
            outputAsset="ETH",
            outputAmount=50.0,
            txHash="0xTxDonation",
            chainNetwork="Ethereum L1",
        ),
    )
    # Hop 2: Vendor Disbursement with receipt hash
    receipt_hash = "f" * 64
    ingest_flow_hop(
        db_session,
        flow.id,
        FlowHopCreate(
            hopNumber=2,
            hopType="VENDOR_DISBURSEMENT",
            title="Vendor Disbursement",
            fromEntity="NGO Treasury",
            toEntity="Vendor Works",
            inputAsset="INR",
            inputAmount=250000.0,
            outputAsset="INR",
            outputAmount=250000.0,
            txHash="BANK-WIRE-99",
            chainNetwork="Banking Wire",
            linkedReceiptHash=receipt_hash,
        ),
    )

    cert = get_impact_certificate_endpoint(
        flow_id=flow.id,
        db=db_session,
        current_user=donor_user,
    )

    assert cert.certificateId == f"CERT-{flow.id}"
    assert cert.flowId == flow.id
    assert cert.donorOrigin == "0xDonorWallet"
    assert cert.merkleRoot.startswith("0x")
    assert len(cert.proofSteps) == 2
    assert receipt_hash in cert.auditedReceiptFingerprints
    assert "ZERO_BENEFICIARY_PII_EXPOSED" in cert.privacyCompliance
    assert cert.isReconciled is True

def test_passive_webhook_ingestion_and_reconciliation(db_session, admin_user):
    flow = create_financial_flow(
        db_session,
        FinancialFlowCreate(
            projectId="PRJ-002",
            title="Webhook Ingestion Flow",
            earmarkTag="Clean water infrastructure",
            initialAsset="ETH",
            initialAmount=50.0,
            initialFiatEstimate=12500000.0,
            finalFiatAvailable=12450000.0,
        ),
    )

    # Ingest passive event via POST /flows/{id}/webhook-event
    webhook_event = PassiveWebhookEvent(
        eventType="DEX_SWAP",
        network="Uniswap v3 (Ethereum L1)",
        txHash="0xSwapTx999",
        fromEntity="0xTreasury",
        toEntity="Uniswap Pool",
        inputAsset="ETH",
        inputAmount=50.0,
        outputAsset="USDC",
        outputAmount=150000.0,
        exchangeRate=3000.0,
        feeAmount=50.0,
        evidenceSummary="Passive webhook from Uniswap Subgraph Indexer",
    )

    hop = ingest_passive_webhook_event(
        flow_id=flow.id,
        event=webhook_event,
        db=db_session,
        current_user=admin_user,
    )

    assert hop.hopNumber == 1
    assert hop.hopType == "DEX_SWAP"
    assert hop.txHash == "0xSwapTx999"
    assert hop.outputAmount == 150000.0



