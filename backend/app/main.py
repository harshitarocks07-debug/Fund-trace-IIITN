import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.user import User, UserRole
from app.models.ngo import NGO
from app.models.project import Project
from app.models.donation import Donation
from app.models.expense import Expense
from app.models.receipt import Receipt
from app.models.audit_log import AuditLog
from app.models.flow import FinancialFlow, FlowHop
from app.core.security import hash_password
from app.services.ngo_service import seed_sample_ngos_if_empty
from app.services.project_service import seed_sample_projects_if_empty
from app.services.donation_service import seed_sample_donations_if_empty
from app.services.expense_service import seed_sample_expenses_if_empty
from app.api.v1.api import api_router


def ensure_schema_columns():
    """Ensure newly added columns exist in SQLite without needing external migrations."""
    with engine.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(receipts)")).fetchall()
            existing_receipt_cols = {row[1] for row in res}
            cols_to_add_receipt = [
                ("extracted_vendor", "VARCHAR(255)"),
                ("extracted_invoice_number", "VARCHAR(100)"),
                ("extracted_date", "VARCHAR(50)"),
                ("extracted_amount", "FLOAT"),
                ("ocr_confidence", "FLOAT"),
                ("ocr_status", "VARCHAR(50)"),
                ("raw_text", "TEXT"),
            ]
            for col_name, col_type in cols_to_add_receipt:
                if col_name not in existing_receipt_cols:
                    conn.execute(text(f"ALTER TABLE receipts ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
        except Exception:
            pass

        try:
            res = conn.execute(text("PRAGMA table_info(expenses)")).fetchall()
            existing_exp_cols = {row[1] for row in res}
            cols_to_add_expenses = [
                ("extracted_vendor", "VARCHAR(255)"),
                ("extracted_invoice_number", "VARCHAR(100)"),
                ("extracted_date", "VARCHAR(50)"),
                ("blockchain_tx_hash", "VARCHAR(66)"),
                ("blockchain_block_number", "INTEGER"),
                ("blockchain_anchored_at", "DATETIME"),
                ("blockchain_commitment_root", "VARCHAR(66)"),
            ]
            for col_name, col_type in cols_to_add_expenses:
                if col_name not in existing_exp_cols:
                    conn.execute(text(f"ALTER TABLE expenses ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
        except Exception:
            pass


def seed_database(db=None):
    """Seed initial demonstration users and records if the database is newly initialized."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        # Check if users already exist
        if db.query(User).count() == 0:
            demo_users = [
                User(
                    email="donor@aarav.org",
                    hashed_password=hash_password("Password123!"),
                    full_name="Aarav Mehta",
                    role=UserRole.DONOR.value,
                    organization="Independent Contributor",
                    is_active=True,
                ),
                User(
                    email="admin@helpinghands.org",
                    hashed_password=hash_password("Password123!"),
                    full_name="Helping Hands Admin",
                    role=UserRole.NGO_ADMIN.value,
                    organization="Helping Hands Foundation",
                    is_active=True,
                ),
                User(
                    email="auditor@trustcheck.org",
                    hashed_password=hash_password("Password123!"),
                    full_name="Priya Nair",
                    role=UserRole.AUDITOR.value,
                    organization="TrustCheck Independent Audit",
                    is_active=True,
                ),
            ]
            db.add_all(demo_users)
            db.commit()

        # Seed projects if empty
        if db.query(Project).count() == 0:
            demo_projects = [
                Project(
                    id="PRJ-001",
                    name="Rural School Construction",
                    title="Rural School Construction",
                    ngo="Helping Hands Foundation",
                    description="Build safe, durable classrooms for children in rural communities.",
                    budget=1000000.0,
                    target_budget=1000000.0,
                    raised=1000000.0,
                    raised_amount=1000000.0,
                    location="Madhya Pradesh",
                    category="Education",
                ),
                Project(
                    id="PRJ-002",
                    name="Clean Water for Bhairavpur",
                    title="Clean Water for Bhairavpur",
                    ngo="Jal Seva Collective",
                    description="Install community water points and test local drinking water.",
                    budget=750000.0,
                    target_budget=750000.0,
                    raised=512000.0,
                    raised_amount=512000.0,
                    location="Rajasthan",
                    category="Clean water",
                ),
                Project(
                    id="PRJ-003",
                    name="Mobile Health Clinic",
                    title="Mobile Health Clinic",
                    ngo="Swasthya Outreach",
                    description="Bring primary healthcare and essential screenings to remote villages.",
                    budget=1200000.0,
                    target_budget=1200000.0,
                    raised=824500.0,
                    raised_amount=824500.0,
                    location="Maharashtra",
                    category="Healthcare",
                ),
            ]
            db.add_all(demo_projects)
            db.commit()

        # Seed donations if empty
        if db.query(Donation).count() == 0:
            demo_donations = [
                Donation(id="DON-1042", project_id="PRJ-001", donor_name="Aarav Mehta", amount=500000.0, date="2026-10-14", reference="PAY-8K2F19"),
                Donation(id="DON-1041", project_id="PRJ-001", donor_name="Nisha Rao", amount=300000.0, date="2026-10-12", reference="PAY-3M7J21"),
                Donation(id="DON-1038", project_id="PRJ-002", donor_name="Kavya Shah", amount=125000.0, date="2026-10-10", reference="PAY-9P1D04"),
                Donation(id="DON-1032", project_id="PRJ-001", donor_name="Rohan Das", amount=200000.0, date="2026-10-08", reference="PAY-7B5L38"),
                Donation(id="DON-1026", project_id="PRJ-003", donor_name="Mira Kapoor", amount=82500.0, date="2026-10-03", reference="PAY-2X6W14"),
            ]
            db.add_all(demo_donations)
            db.commit()

        # Seed expenses if empty
        if db.query(Expense).count() == 0:
            demo_expenses = [
                Expense(
                    id="EXP-001",
                    project_id="PRJ-001",
                    vendor="ABC Building Supplies",
                    vendor_name="ABC Building Supplies",
                    title="Building Materials & Supplies",
                    category="Construction",
                    invoice_number="INV-2026-101",
                    amount=200000.0,
                    claimed_amount=200000.0,
                    extracted_amount=200000.0,
                    receipt_name="invoice_001.pdf",
                    receipt_hash="a81f4d2c9b7e6a1083d5f7c1e9a2b4d6f8c0e1a3b5d7f9c2e4a6b8d0f2a4c6e8",
                    status="Approved",
                    risk_score=12,
                    risk_reasons=json.dumps(["Amount matches submitted invoice"]),
                    date="2026-10-18",
                    blockchain_status="Not submitted",
                ),
                Expense(
                    id="EXP-002",
                    project_id="PRJ-001",
                    vendor="Shree Cement Depot",
                    vendor_name="Shree Cement Depot",
                    title="Cement Sacks & Concrete",
                    category="Materials",
                    invoice_number="INV-2026-118",
                    amount=160000.0,
                    claimed_amount=160000.0,
                    extracted_amount=120000.0,
                    receipt_name="cement_invoice.jpg",
                    receipt_hash="bf92cfa7d1e34c008b56cfc711e90a5c0d89f72a15c4e3b6098d7f2a1c5e6b48",
                    status="Pending review",
                    risk_score=58,
                    risk_reasons=json.dumps(["Claimed amount differs from entered receipt amount by ₹40,000"]),
                    date="2026-10-21",
                    blockchain_status="Not submitted",
                ),
            ]
            db.add_all(demo_expenses)
            db.commit()

        # Seed audit log if empty
        if db.query(AuditLog).count() == 0:
            demo_audits = [
                AuditLog(
                    id="AUD-001",
                    expense_id="EXP-001",
                    action="Approved",
                    actor="Priya Nair (Auditor)",
                    reason="Receipt matches vendor invoice and claimed amounts tally.",
                    date="2026-10-19",
                ),
                AuditLog(
                    id="AUD-002",
                    expense_id="EXP-002",
                    action="Expense submitted",
                    actor="Helping Hands Admin",
                    reason="Submitted for auditor review.",
                    date="2026-10-21",
                ),
            ]
            db.add_all(demo_audits)
            db.commit()

        # Seed initial financial flow if empty
        if db.query(FinancialFlow).count() == 0:
            demo_flow = FinancialFlow(
                id="FLOW-001",
                project_id="PRJ-002",
                title="50 ETH Earmarked for Water Infrastructure - Bhairavpur",
                earmark_tag="Clean water infrastructure",
                source_chain="Ethereum Mainnet (L1)",
                initial_asset="ETH",
                initial_amount=50.0,
                initial_fiat_estimate=12500000.0,
                final_fiat_available=12450000.0,
                disbursed_fiat_amount=285000.0,
                remaining_fiat_amount=12165000.0,
                status="Active",
            )
            db.add(demo_flow)
            db.commit()

            demo_hops = [
                FlowHop(
                    id="HOP-FLOW-001-01",
                    flow_id="FLOW-001",
                    hop_number=1,
                    hop_type="CRYPTO_DONATION",
                    title="50 ETH Earmarked Donation (L1)",
                    from_entity="Donor Wallet: 0x71C...b84A",
                    to_entity="Jal Seva Multi-Sig Treasury: 0x4B2...e90F",
                    input_asset="ETH",
                    input_amount=50.0,
                    output_asset="ETH",
                    output_amount=50.0,
                    exchange_rate=1.0,
                    fee_amount=0.004,
                    tx_hash="0x8f3c7e1a90b4d6c8e0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6",
                    chain_network="Ethereum Mainnet (L1)",
                    status="CONFIRMED",
                    evidence_summary="On-chain ERC-20 / Native ETH transfer confirmed at block #19827301 with earmark tag 'Clean water infrastructure'.",
                ),
                FlowHop(
                    id="HOP-FLOW-001-02",
                    flow_id="FLOW-001",
                    hop_number=2,
                    hop_type="DEX_SWAP",
                    title="Uniswap v3 Swap: ETH ➔ USDC",
                    from_entity="Jal Seva Multi-Sig: 0x4B2...e90F",
                    to_entity="Uniswap V3 Pool",
                    input_asset="ETH",
                    input_amount=50.0,
                    output_asset="USDC",
                    output_amount=150000.0,
                    exchange_rate=3000.0,
                    fee_amount=75.0,
                    tx_hash="0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
                    chain_network="Ethereum Mainnet (L1)",
                    status="CONFIRMED",
                    evidence_summary="Swapped 50 ETH for 150,000 USDC via Uniswap v3 0.05% fee pool with 0.12% minimal slippage.",
                ),
                FlowHop(
                    id="HOP-FLOW-001-03",
                    flow_id="FLOW-001",
                    hop_number=3,
                    hop_type="CROSS_CHAIN_BRIDGE",
                    title="Stargate Bridge: Ethereum ➔ Polygon",
                    from_entity="Ethereum Router: 0x873...b9",
                    to_entity="Polygon L2 Treasury: 0x3d9...1a",
                    input_asset="USDC",
                    input_amount=150000.0,
                    output_asset="USDC",
                    output_amount=149950.0,
                    exchange_rate=1.0,
                    fee_amount=50.0,
                    tx_hash="0x4e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d",
                    chain_network="Stargate / LayerZero Bridge",
                    status="CONFIRMED",
                    evidence_summary="Cross-chain messaging and liquidity transfer via LayerZero relayer; verified on Polygon block #56102930.",
                ),
                FlowHop(
                    id="HOP-FLOW-001-04",
                    flow_id="FLOW-001",
                    hop_number=4,
                    hop_type="FIAT_OFFRAMP",
                    title="Compliant Fiat Off-Ramp: USDC ➔ INR",
                    from_entity="Polygon L2 Treasury: 0x3d9...1a",
                    to_entity="Jal Seva Collective Bank Treasury Account",
                    input_asset="USDC",
                    input_amount=149950.0,
                    output_asset="INR",
                    output_amount=12450000.0,
                    exchange_rate=83.02,
                    fee_amount=12000.0,
                    tx_hash="BANK-OR-9921",
                    chain_network="Regulated Gateway / Direct Bank Wire",
                    status="CONFIRMED",
                    evidence_summary="zkTLS-attested conversion and wire transfer to registered NGO project bank account; zero donor or beneficiary PII leaked.",
                ),
                FlowHop(
                    id="HOP-FLOW-001-05",
                    flow_id="FLOW-001",
                    hop_number=5,
                    hop_type="VENDOR_DISBURSEMENT",
                    title="Vendor Payment: Rajasthan Pipe Works (Pipes & Valves)",
                    from_entity="Jal Seva Collective Bank Treasury Account",
                    to_entity="Rajasthan Pipe Works (Local Vendor)",
                    input_asset="INR",
                    input_amount=285000.0,
                    output_asset="INR",
                    output_amount=285000.0,
                    exchange_rate=1.0,
                    fee_amount=0.0,
                    tx_hash="BANK-WIRE-EXP-003",
                    chain_network="Off-Chain Banking Wire / Local Settlement",
                    status="CONFIRMED",
                    linked_expense_id="EXP-003",
                    linked_receipt_hash="a81f4d2c9b7e6a1083d5f7c1e9a2b4d6f8c0e1a3b5d7f9c2e4a6b8d0f2a4c6e8",
                    evidence_summary="Payment for water distribution pipeline materials. Audited receipt fingerprint verified on-chain.",
                ),
            ]
            db.add_all(demo_hops)
            db.commit()

    finally:
        if should_close:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize database tables
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns()
    # 2. Seed all demonstration data and initial entities
    db = SessionLocal()
    try:
        seed_sample_ngos_if_empty(db)
        seed_database(db)
        seed_sample_projects_if_empty(db)
        seed_sample_donations_if_empty(db)
        seed_sample_expenses_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for FundTrace: Transparent NGO fund tracing, profile management, and verification.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

cors_origins = getattr(settings, "BACKEND_CORS_ORIGINS", None) or getattr(settings, "CORS_ORIGINS", ["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
def root():
    return {
        "app": settings.PROJECT_NAME,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
