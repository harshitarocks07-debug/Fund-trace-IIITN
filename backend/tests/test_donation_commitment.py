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
from app.models.donation import Donation
from app.models.expense import Expense
from app.models.receipt import Receipt
from app.models.audit_log import AuditLog
from app.models.flow import FinancialFlow, FlowHop
from app.schemas.donation import (
    DonationCreate,
    DonationCommitmentVerifyRequest,
    DonationPaymentVerifyRequest,
)
from app.services.donation_service import (
    generate_donation_salt,
    compute_donation_commitment,
    anchor_donation_commitment_on_chain,
    verify_donation_commitment_on_chain,
    verify_donation_preimage_credentials,
    verify_actual_payment_transaction,
)

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
    proj = Project(
        id="PRJ-001",
        name="Rural School Construction",
        ngo="Helping Hands",
        description="Classroom construction",
        budget=1000000.0,
        raised=0.0,
        location="Madhya Pradesh",
        category="Education",
    )
    session.add(proj)

    donor = User(
        id=1,
        email="donor@aarav.org",
        full_name="Aarav Mehta",
        role=UserRole.DONOR.value,
        organization="Independent Donor",
        is_active=True,
    )
    session.add(donor)

    auditor = User(
        id=2,
        email="auditor@trustcheck.org",
        full_name="Priya Nair",
        role=UserRole.AUDITOR.value,
        organization="TrustCheck",
        is_active=True,
    )
    session.add(auditor)
    session.commit()

    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)

def test_donation_commitment_generation():
    salt = generate_donation_salt()
    assert salt.startswith("0x")
    assert len(salt) == 66

    commitment = compute_donation_commitment(
        donation_id="DON-001",
        project_id="PRJ-001",
        amount=50000.0,
        payment_reference="PAY-REF-01",
        blinding_salt=salt,
    )
    assert commitment.startswith("0x")
    assert len(commitment) == 66

    # Determinism check
    commitment2 = compute_donation_commitment(
        donation_id="DON-001",
        project_id="PRJ-001",
        amount=50000.0,
        payment_reference="PAY-REF-01",
        blinding_salt=salt,
    )
    assert commitment == commitment2

    # Different salt produces different commitment
    salt2 = generate_donation_salt()
    commitment3 = compute_donation_commitment(
        donation_id="DON-001",
        project_id="PRJ-001",
        amount=50000.0,
        payment_reference="PAY-REF-01",
        blinding_salt=salt2,
    )
    assert commitment != commitment3

def test_anchor_and_verify_donation_commitment(db_session):
    donation = Donation(
        id="DON-TEST-100",
        project_id="PRJ-001",
        donor_id=1,
        donor_name="Aarav Mehta",
        donor_email="donor@aarav.org",
        donor_phone="+91-9876543210",
        amount=75000.0,
        date="2026-10-26",
        reference="PAY-XYZ-99",
        payment_status="Pending",
    )
    db_session.add(donation)
    db_session.commit()

    # Anchor commitment
    res = anchor_donation_commitment_on_chain(db_session, donation)
    assert donation.blockchain_status == "Confirmed"
    assert donation.commitment_hash is not None
    assert donation.blinding_salt is not None
    assert donation.blockchain_tx_hash is not None
    assert donation.blockchain_block_number is not None

    # Verify commitment without donor PII
    verify_res = verify_donation_commitment_on_chain(
        db_session,
        donation.id,
        donation.commitment_hash
    )
    assert verify_res.verified is True
    assert verify_res.isHashMatch is True
    assert "ZERO_PII_EXPOSED" in verify_res.piiStatus

    # Verify preimage
    preimage_res = verify_donation_preimage_credentials(
        db_session,
        donation.id,
        donation.project_id,
        donation.amount,
        donation.reference,
        donation.blinding_salt,
    )
    assert preimage_res.verified is True
    assert preimage_res.isHashMatch is True

def test_verify_payment_separately(db_session):
    donation = Donation(
        id="DON-PAY-200",
        project_id="PRJ-001",
        donor_id=1,
        donor_name="Aarav Mehta",
        amount=100000.0,
        date="2026-10-26",
        reference="PAY-BANK-77",
        payment_status="Pending",
    )
    db_session.add(donation)
    db_session.commit()

    auditor = db_session.query(User).filter(User.role == UserRole.AUDITOR.value).first()
    pay_res = verify_actual_payment_transaction(
        db=db_session,
        donation_id=donation.id,
        payment_tx_hash="BANK-WIRE-REF-998877",
        payment_method="RTGS Transfer",
        auditor_or_admin=auditor,
    )

    assert pay_res.paymentStatus == "Verified"
    assert pay_res.paymentTxHash == "BANK-WIRE-REF-998877"
    assert donation.payment_status == "Verified"
    assert donation.payment_tx_hash == "BANK-WIRE-REF-998877"

    # Verify audit trail
    audit_entry = db_session.query(AuditLog).filter(AuditLog.action == "Donation Payment Verified").first()
    assert audit_entry is not None
    assert "BANK-WIRE-REF-998877" in audit_entry.reason
