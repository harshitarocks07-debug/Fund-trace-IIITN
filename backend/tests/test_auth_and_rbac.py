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
from app.models.donation import Donation
from app.models.expense import Expense
from app.models.audit_log import AuditLog
from app.schemas.auth import UserCreate, UserLogin
from app.schemas.project import ProjectCreate
from app.schemas.donation import DonationCreate
from app.schemas.expense import ExpenseCreate, ExpenseReview
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.permissions import require_role, require_donor, require_ngo_admin, require_auditor, require_ngo_admin_or_auditor, get_role_capabilities
from app.api.v1.endpoints.auth import register_user, login_user
from app.api.v1.endpoints.projects import create_project, list_projects
from app.api.v1.endpoints.donations import record_donation, list_donations
from app.api.v1.endpoints.expenses import submit_expense, review_expense, list_expenses
from app.api.v1.endpoints.audit import get_audit_trail

settings.HASH_ITERATIONS = 1000

@pytest.fixture(scope="module")
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
        id="PRJ-100",
        name="Test Initial Project",
        ngo="Helping Hands Foundation",
        description="Initial project for testing",
        budget=1000000.0,
        raised=50000.0,
        location="Pune",
        category="Education",
    )
    session.add(sample_proj)
    session.commit()
    
    yield session
    session.close()

def test_user_registration(db_session):
    # 1. Register Donor
    res_donor = register_user(
        UserCreate(email="unit_donor@test.com", password="Password123!", full_name="Unit Donor", role="Donor"),
        db=db_session
    )
    assert res_donor.user.email == "unit_donor@test.com"
    assert res_donor.user.role == "Donor"
    assert res_donor.access_token is not None

    # 2. Register NGO Admin
    res_ngo = register_user(
        UserCreate(email="unit_ngo@test.com", password="Password123!", full_name="Unit NGO", role="NGO admin", organization="Relief Org"),
        db=db_session
    )
    assert res_ngo.user.email == "unit_ngo@test.com"
    assert res_ngo.user.role == "NGO admin"
    assert res_ngo.user.organization == "Relief Org"

    # 3. Register Auditor
    res_auditor = register_user(
        UserCreate(email="unit_auditor@test.com", password="Password123!", full_name="Unit Auditor", role="Auditor"),
        db=db_session
    )
    assert res_auditor.user.email == "unit_auditor@test.com"
    assert res_auditor.user.role == "Auditor"

def test_duplicate_email_registration_rejected(db_session):
    with pytest.raises(HTTPException) as exc_info:
        register_user(
            UserCreate(email="unit_donor@test.com", password="Password123!", full_name="Duplicate", role="Donor"),
            db=db_session
        )
    assert exc_info.value.status_code == 400
    assert "already exists" in exc_info.value.detail

def test_invalid_role_rejected(db_session):
    with pytest.raises(HTTPException) as exc_info:
        register_user(
            UserCreate(email="invalid_role@test.com", password="Password123!", full_name="Bad Role", role="SuperUser"),
            db=db_session
        )
    assert exc_info.value.status_code == 400
    assert "Unknown role" in exc_info.value.detail

def test_user_login(db_session):
    # Valid login
    token_resp = login_user(UserLogin(email="unit_donor@test.com", password="Password123!"), db=db_session)
    assert token_resp.access_token is not None
    assert token_resp.user.email == "unit_donor@test.com"

    # Wrong password
    with pytest.raises(HTTPException) as exc_info:
        login_user(UserLogin(email="unit_donor@test.com", password="WrongPassword!"), db=db_session)
    assert exc_info.value.status_code == 401
    assert "Incorrect email or password" in exc_info.value.detail

    # Non-existent email
    with pytest.raises(HTTPException) as exc_info:
        login_user(UserLogin(email="nonexistent@test.com", password="Password123!"), db=db_session)
    assert exc_info.value.status_code == 401

def test_token_creation_and_verification():
    token = create_access_token(subject=42, claims={"email": "donor@test.com", "role": "Donor"})
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["email"] == "donor@test.com"
    assert payload["role"] == "Donor"

    # Tampered token
    tampered = token[:-4] + "abcd"
    assert decode_access_token(tampered) is None

def test_rbac_project_creation_permissions(db_session):
    ngo_user = db_session.query(User).filter(User.role == "NGO admin").first()
    donor_user = db_session.query(User).filter(User.role == "Donor").first()
    auditor_user = db_session.query(User).filter(User.role == "Auditor").first()

    # 1. NGO Admin creates project -> Allowed
    proj_in = ProjectCreate(
        name="Solar Powered Dispensary",
        description="Provide solar power for cold chain medical storage",
        budget=400000.0,
        location="Odisha",
        category="Healthcare",
    )
    proj = create_project(proj_in, db=db_session, current_user=ngo_user)
    assert proj.name == "Solar Powered Dispensary"
    assert proj.id.startswith("PRJ-")

    # 2. Donor attempts project creation -> require_ngo_admin raises 403
    with pytest.raises(HTTPException) as exc_donor:
        require_ngo_admin(donor_user)
    assert exc_donor.value.status_code == 403
    assert "Access forbidden" in exc_donor.value.detail

    # 3. Auditor attempts project creation -> require_ngo_admin raises 403
    with pytest.raises(HTTPException) as exc_auditor:
        require_ngo_admin(auditor_user)
    assert exc_auditor.value.status_code == 403

def test_rbac_donation_permissions(db_session):
    donor_user = db_session.query(User).filter(User.role == "Donor").first()
    ngo_user = db_session.query(User).filter(User.role == "NGO admin").first()
    auditor_user = db_session.query(User).filter(User.role == "Auditor").first()

    # 1. Donor records donation -> Allowed
    don_in = DonationCreate(projectId="PRJ-100", amount=25000.0)
    don = record_donation(don_in, db=db_session, current_user=donor_user)
    assert don.amount == 25000.0
    assert don.donor == donor_user.full_name

    # 2. NGO Admin attempts donation -> require_donor raises 403
    with pytest.raises(HTTPException) as exc_ngo:
        require_donor(ngo_user)
    assert exc_ngo.value.status_code == 403
    assert "Access forbidden" in exc_ngo.value.detail

    # 3. Auditor attempts donation -> require_donor raises 403
    with pytest.raises(HTTPException) as exc_auditor:
        require_donor(auditor_user)
    assert exc_auditor.value.status_code == 403

def test_rbac_expense_submission_permissions(db_session):
    donor_user = db_session.query(User).filter(User.role == "Donor").first()
    ngo_user = db_session.query(User).filter(User.role == "NGO admin").first()
    auditor_user = db_session.query(User).filter(User.role == "Auditor").first()

    # 1. NGO Admin submits expense -> Allowed
    exp_in = ExpenseCreate(
        projectId="PRJ-100",
        vendor="Test Solar Inverters Co.",
        category="Equipment",
        invoiceNumber="INV-TSIC-01",
        claimedAmount=65000.0,
        receiptName="inverter_receipt.pdf",
        receiptHash="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        extractedAmount=65000.0,
    )
    exp = submit_expense(exp_in, db=db_session, current_user=ngo_user)
    assert exp.vendor == "Test Solar Inverters Co."
    assert exp.status == "Pending review"

    # 2. Donor attempts expense submission -> require_ngo_admin raises 403
    with pytest.raises(HTTPException) as exc_donor:
        require_ngo_admin(donor_user)
    assert exc_donor.value.status_code == 403

    # 3. Auditor attempts expense submission -> require_ngo_admin raises 403
    with pytest.raises(HTTPException) as exc_auditor:
        require_ngo_admin(auditor_user)
    assert exc_auditor.value.status_code == 403

def test_rbac_expense_review_permissions(db_session):
    donor_user = db_session.query(User).filter(User.role == "Donor").first()
    ngo_user = db_session.query(User).filter(User.role == "NGO admin").first()
    auditor_user = db_session.query(User).filter(User.role == "Auditor").first()

    exp = db_session.query(Expense).first()
    assert exp is not None

    # 1. Auditor reviews expense -> Allowed
    rev_in = ExpenseReview(status="Approved", reason="Receipt hash verified and invoice totals verified.")
    reviewed = review_expense(exp.id, rev_in, db=db_session, current_user=auditor_user)
    assert reviewed.status == "Approved"

    # Verify audit log was recorded for this review
    audit = db_session.query(AuditLog).filter(AuditLog.expense_id == exp.id, AuditLog.action == "Approved").first()
    assert audit is not None
    assert audit.actor == auditor_user.full_name

    # 2. NGO Admin attempts review -> require_auditor raises 403
    with pytest.raises(HTTPException) as exc_ngo:
        require_auditor(ngo_user)
    assert exc_ngo.value.status_code == 403

    # 3. Donor attempts review -> require_auditor raises 403
    with pytest.raises(HTTPException) as exc_donor:
        require_auditor(donor_user)
    assert exc_donor.value.status_code == 403

def test_rbac_audit_log_access(db_session):
    donor_user = db_session.query(User).filter(User.role == "Donor").first()
    ngo_user = db_session.query(User).filter(User.role == "NGO admin").first()
    auditor_user = db_session.query(User).filter(User.role == "Auditor").first()

    # Auditor can access audit log
    logs_auditor = get_audit_trail(db=db_session, current_user=auditor_user)
    assert len(logs_auditor) >= 1

    # NGO Admin can access audit log
    logs_ngo = get_audit_trail(db=db_session, current_user=ngo_user)
    assert len(logs_ngo) >= 1

    # Donor is forbidden from accessing audit log
    with pytest.raises(HTTPException) as exc_donor:
        require_ngo_admin_or_auditor(donor_user)
    assert exc_donor.value.status_code == 403
    assert "Access forbidden" in exc_donor.value.detail

def test_role_capabilities_matrix():
    donor_caps = get_role_capabilities("Donor")
    assert donor_caps["capabilities"]["can_donate"] is True
    assert donor_caps["capabilities"]["can_create_project"] is False
    assert donor_caps["capabilities"]["can_review_expense"] is False
    assert donor_caps["capabilities"]["can_view_audit_log"] is False

    ngo_caps = get_role_capabilities("NGO admin")
    assert ngo_caps["capabilities"]["can_create_project"] is True
    assert ngo_caps["capabilities"]["can_submit_expense"] is True
    assert ngo_caps["capabilities"]["can_review_expense"] is False
    assert ngo_caps["capabilities"]["can_view_audit_log"] is True

    auditor_caps = get_role_capabilities("Auditor")
    assert auditor_caps["capabilities"]["can_review_expense"] is True
    assert auditor_caps["capabilities"]["can_verify_receipts"] is True
    assert auditor_caps["capabilities"]["can_create_project"] is False
    assert auditor_caps["capabilities"]["can_submit_expense"] is False

