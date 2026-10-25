import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.expense import Expense
from app.models.audit_log import AuditLog
from app.services.blockchain_service import (
    calculate_keccak256_commitment,
    generate_deterministic_tx_hash,
    anchor_expense_on_chain,
    verify_on_chain_seal,
    get_ledger_status,
)
from app.api.v1.endpoints.blockchain import anchor_expense, verify_expense_seal, get_status

settings.HASH_ITERATIONS = 1000

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
        id="PRJ-001",
        name="School Construction",
        ngo="Helping Hands Foundation",
        description="Classroom construction",
        budget=1000000.0,
        raised=1000000.0,
        location="Madhya Pradesh",
        category="Education",
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
        email="admin@helpinghands.org",
        full_name="Helping Hands Admin",
        role=UserRole.NGO_ADMIN.value,
        organization="Helping Hands Foundation",
        is_active=True,
    )

@pytest.fixture
def auditor_user():
    return User(
        id=2,
        email="auditor@trustcheck.org",
        full_name="Priya Nair",
        role=UserRole.AUDITOR.value,
        organization="TrustCheck",
        is_active=True,
    )

@pytest.fixture
def donor_user():
    return User(
        id=3,
        email="donor@citizen.org",
        full_name="Aarav Mehta",
        role=UserRole.DONOR.value,
        organization="Citizen Contributor",
        is_active=True,
    )

def test_commitment_calculation_deterministic():
    c1 = calculate_keccak256_commitment("PRJ-001", "EXP-001", "a" * 64, "auditor:priya", "2026-10-25T16:00:00")
    c2 = calculate_keccak256_commitment("PRJ-001", "EXP-001", "a" * 64, "auditor:priya", "2026-10-25T16:00:00")
    c3 = calculate_keccak256_commitment("PRJ-001", "EXP-001", "b" * 64, "auditor:priya", "2026-10-25T16:00:00")
    assert c1 == c2
    assert c1 != c3
    assert c1.startswith("0x")

def test_anchor_approved_expense_on_chain(db_session, auditor_user):
    sample_hash = "a81f4d2c9b7e6a1083d5f7c1e9a2b4d6f8c0e1a3b5d7f9c2e4a6b8d0f2a4c6e8"
    expense = Expense(
        id="EXP-101",
        project_id="PRJ-001",
        vendor="ABC Supplies",
        category="Construction",
        invoice_number="INV-101",
        claimed_amount=200000.0,
        receipt_name="invoice.pdf",
        receipt_hash=sample_hash,
        status="Approved",
        risk_score=10,
        date="2026-10-20",
        blockchain_status="Not submitted",
    )
    db_session.add(expense)
    db_session.commit()

    result = anchor_expense_on_chain(db_session, expense, auditor_user)

    assert result["blockchainStatus"] == "Confirmed"
    assert result["blockchainTxHash"].startswith("0x")
    assert result["blockchainBlockNumber"] > 0
    assert result["blockchainCommitmentRoot"].startswith("0x")

    # Verify expense record in DB
    refreshed = db_session.query(Expense).filter(Expense.id == "EXP-101").first()
    assert refreshed.blockchain_status == "Confirmed"
    assert refreshed.blockchain_tx_hash == result["blockchainTxHash"]
    assert refreshed.blockchain_block_number == result["blockchainBlockNumber"]

    # Verify audit log entry was generated
    audit_entry = db_session.query(AuditLog).filter(AuditLog.expense_id == "EXP-101").first()
    assert audit_entry is not None
    assert audit_entry.action == "Blockchain anchored"
    assert "Cryptographic receipt seal anchored" in audit_entry.reason

def test_anchor_non_approved_expense_fails(db_session, auditor_user):
    expense = Expense(
        id="EXP-102",
        project_id="PRJ-001",
        vendor="Shree Cement",
        category="Materials",
        invoice_number="INV-102",
        claimed_amount=160000.0,
        receipt_name="cement.jpg",
        receipt_hash="bf92cfa7d1e34c008b56cfc711e90a5c0d89f72a15c4e3b6098d7f2a1c5e6b48",
        status="Pending review",  # Not approved!
        date="2026-10-21",
        blockchain_status="Not submitted",
    )
    db_session.add(expense)
    db_session.commit()

    with pytest.raises(ValueError, match="Cannot anchor expense"):
        anchor_expense_on_chain(db_session, expense, auditor_user)

def test_verify_on_chain_seal(db_session, auditor_user):
    sample_hash = "a81f4d2c9b7e6a1083d5f7c1e9a2b4d6f8c0e1a3b5d7f9c2e4a6b8d0f2a4c6e8"
    expense = Expense(
        id="EXP-103",
        project_id="PRJ-001",
        vendor="ABC Supplies",
        category="Construction",
        invoice_number="INV-103",
        claimed_amount=200000.0,
        receipt_name="invoice.pdf",
        receipt_hash=sample_hash,
        status="Approved",
        date="2026-10-20",
        blockchain_status="Not submitted",
    )
    db_session.add(expense)
    db_session.commit()

    anchor_expense_on_chain(db_session, expense, auditor_user)

    # 1. Exact match
    res_valid = verify_on_chain_seal(db_session, "EXP-103", sample_hash)
    assert res_valid["verified"] is True
    assert res_valid["isHashMatch"] is True
    assert res_valid["blockchainTxHash"].startswith("0x")

    # 2. Tampered / wrong receipt hash
    wrong_hash = "f" * 64
    res_invalid = verify_on_chain_seal(db_session, "EXP-103", wrong_hash)
    assert res_invalid["verified"] is False
    assert res_invalid["isHashMatch"] is False

def test_blockchain_api_endpoints(db_session, auditor_user, donor_user):
    sample_hash = "c" * 64
    expense = Expense(
        id="EXP-104",
        project_id="PRJ-001",
        vendor="Test Vendor",
        category="Construction",
        invoice_number="INV-104",
        claimed_amount=50000.0,
        receipt_name="test.pdf",
        receipt_hash=sample_hash,
        status="Approved",
        date="2026-10-22",
        blockchain_status="Not submitted",
    )
    db_session.add(expense)
    db_session.commit()

    # 1. Endpoint POST /anchor-expense/{id} as Auditor
    anchor_res = anchor_expense("EXP-104", db=db_session, current_user=auditor_user)
    assert anchor_res["blockchainStatus"] == "Confirmed"

    # 2. Endpoint GET /verify/{id} as Donor
    verify_res = verify_expense_seal("EXP-104", receipt_hash=sample_hash, db=db_session, current_user=donor_user)
    assert verify_res["verified"] is True

    # 3. Endpoint GET /status as Donor
    status_res = get_status(db=db_session, current_user=donor_user)
    assert status_res["status"] == "operational"
    assert status_res["totalAnchoredClaims"] >= 1

