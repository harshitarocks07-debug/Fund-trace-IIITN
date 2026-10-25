from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.flow import FinancialFlow
from app.schemas.flow import (
    FinancialFlowCreate,
    FinancialFlowOut,
    FlowHopCreate,
    FlowHopOut,
    FlowReconciliationResult,
    TimelineImpactView,
    ZKAttestationProof,
    ImpactCertificateOut,
    PassiveWebhookEvent,
)
from app.core.permissions import get_current_user, require_ngo_admin_or_auditor, require_ngo_admin
from app.services.flow_service import (
    create_financial_flow,
    ingest_flow_hop,
    link_expense_to_flow,
    reconcile_flow,
    reconstruct_timeline_impact_view,
    serialize_flow,
    serialize_hop,
)
from app.services.zk_attestation_service import verify_zk_offramp_attestation
from app.services.impact_certificate_service import (
    generate_impact_certificate,
    handle_passive_webhook_event,
)

router = APIRouter()

@router.get("", response_model=List[FinancialFlowOut])
def list_financial_flows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all tracked multi-hop financial flows.
    Accessible to Donors, NGO Admins, and Auditors.
    """
    flows = db.query(FinancialFlow).order_by(FinancialFlow.created_at.desc()).all()
    return [serialize_flow(f) for f in flows]

@router.get("/{flow_id}", response_model=TimelineImpactView)
def get_flow_timeline(
    flow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get full reconstructed multi-hop timeline and reconciliation report for a flow.
    """
    try:
        return reconstruct_timeline_impact_view(db, flow_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("", response_model=FinancialFlowOut, status_code=status.HTTP_201_CREATED)
def create_flow(
    flow_in: FinancialFlowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Initialize a new multi-hop financial flow tracker for an earmarked crypto donation.
    """
    try:
        flow = create_financial_flow(db, flow_in)
        return serialize_flow(flow)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{flow_id}/hops", response_model=FlowHopOut, status_code=status.HTTP_201_CREATED)
def ingest_hop(
    flow_id: str,
    hop_in: FlowHopCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Passively ingest an on-chain swap, cross-chain bridge, or fiat off-ramp hop into the flow.
    """
    try:
        hop = ingest_flow_hop(db, flow_id, hop_in)
        return serialize_hop(hop)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{flow_id}/link-expense/{expense_id}", response_model=FlowHopOut)
def link_expense(
    flow_id: str,
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin),
):
    """
    Link an off-chain vendor expense claim to an earmarked financial flow.
    """
    try:
        hop = link_expense_to_flow(db, flow_id, expense_id)
        return serialize_hop(hop)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{flow_id}/reconcile", response_model=FlowReconciliationResult)
def reconcile_flow_endpoint(
    flow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run autonomous reconciliation checking for earmark diversion, slippage, and overdraw.
    """
    try:
        return reconcile_flow(db, flow_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/{flow_id}/zk-proof/{hop_number}", response_model=ZKAttestationProof)
def get_zk_proof_endpoint(
    flow_id: str,
    hop_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve and cryptographically verify a zero-knowledge TLS (zkTLS) attestation
    for a fiat off-ramp or vendor settlement hop, guaranteeing 100% beneficiary PII privacy.
    """
    try:
        return verify_zk_offramp_attestation(db, flow_id, hop_number)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/{flow_id}/certificate", response_model=ImpactCertificateOut)
def get_impact_certificate_endpoint(
    flow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an immutable Cryptographic Impact Certificate for an earmarked donation.
    Builds a Merkle tree proof connecting the original crypto donation directly
    to ground vendor receipts while mathematically ensuring Zero Beneficiary PII leakage.
    """
    try:
        return generate_impact_certificate(db, flow_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/{flow_id}/webhook-event", response_model=FlowHopOut, status_code=status.HTTP_201_CREATED)
def ingest_passive_webhook_event(
    flow_id: str,
    event: PassiveWebhookEvent,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Passively ingest external on-chain or banking webhook events (e.g. Alchemy, Uniswap,
    Stargate LayerZero relayer, Open Banking gateway) and autonomously trigger reconciliation.
    """
    try:
        hop, _ = handle_passive_webhook_event(db, flow_id, event)
        return serialize_hop(hop)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

