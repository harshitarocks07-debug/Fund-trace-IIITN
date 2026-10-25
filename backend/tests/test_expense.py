import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException
from pydantic import ValidationError

from app.db.base import Base
from app.models.ngo import NGO
from app.models.project import Project
from app.models.expense import Expense
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseStatusUpdate,
)
from app.api.v1.endpoints.expenses import (
    submit_expense,
    list_expenses,
    get_expense,
    update_expense,
    update_expense_status,
    get_expense_statistics,
    delete_expense,
)

# Setup isolated in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sample_ngo(db):
    ngo = NGO(
        name="Vidya Jyoti Foundation",
        registration_number="MH-NGP-2024-EXP1",
        category="Education",
        contact_email="exp@vidyajyoti.org",
        contact_phone="+91-9876543210",
        city="Nagpur",
        state="Maharashtra",
        total_funds_utilized=20000.0,
        is_active=True,
    )
    db.add(ngo)
    db.commit()
    db.refresh(ngo)
    return ngo


@pytest.fixture
def sample_project(db, sample_ngo):
    project = Project(
        ngo_id=sample_ngo.id,
        title="Digital Classrooms Initiative",
        category="Education",
        target_budget=500000.0,
        raised_amount=300000.0,
        utilized_amount=20000.0,
        status="ACTIVE",
        is_active=True,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def test_submit_expense_pending(db, sample_ngo, sample_project):
    """Verify submitting an expense with status PENDING stores details without

    immediate utilization credit.
    """
    initial_project_utilized = sample_project.utilized_amount
    initial_ngo_utilized = sample_ngo.total_funds_utilized

    expense_data = ExpenseCreate(
        title="Classroom Tablets and Charging Hubs",
        description="25 rugged tablets procured for school lab",
        category="Hardware",
        amount=75000.0,
        currency="INR",
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        payment_mode="BANK_TRANSFER",
        vendor_name="Vidarbha Tech Solutions",
        invoice_number="VTS-2024-889",
        status="PENDING",
    )

    resp = submit_expense(expense_in=expense_data, db=db, current_user=None)

    assert resp.id is not None
    assert resp.title == "Classroom Tablets and Charging Hubs"
    assert resp.amount == 75000.0
    assert resp.status == "PENDING"
    assert resp.is_verified is False
    assert resp.project_title == "Digital Classrooms Initiative"
    assert resp.ngo_name == "Vidya Jyoti Foundation"
    assert resp.receipt_hash.startswith("Qm")
    assert resp.invoice_number == "VTS-2024-889"

    # Pending expenses do NOT increment utilization yet
    db.refresh(sample_project)
    db.refresh(sample_ngo)
    assert sample_project.utilized_amount == initial_project_utilized
    assert sample_ngo.total_funds_utilized == initial_ngo_utilized


def test_submit_expense_approved_immediate_credit(db, sample_ngo, sample_project):
    """Verify submitting an already APPROVED expense immediately credits project

    and NGO utilization and mints tx_hash.
    """
    initial_project_utilized = sample_project.utilized_amount
    initial_ngo_utilized = sample_ngo.total_funds_utilized

    expense_data = ExpenseCreate(
        title="School Teacher Digital Training",
        category="Training",
        amount=40000.0,
        currency="INR",
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        payment_mode="BANK_TRANSFER",
        vendor_name="Shiksha Training Institute",
        invoice_number="STI-2024-001",
        status="APPROVED",
    )

    resp = submit_expense(expense_in=expense_data, db=db, current_user=None)

    assert resp.status == "APPROVED"
    assert resp.is_verified is True
    assert resp.verified_at is not None
    assert resp.tx_hash.startswith("0x")

    db.refresh(sample_project)
    db.refresh(sample_ngo)
    assert sample_project.utilized_amount == initial_project_utilized + 40000.0
    assert sample_ngo.total_funds_utilized == initial_ngo_utilized + 40000.0


def test_submit_expense_invalid_ngo(db):
    """Verify submitting an expense for a non-existent NGO raises 404."""
    expense_data = ExpenseCreate(
        title="Orphan Expense",
        category="Operational",
        amount=5000.0,
        ngo_id=99999,
        payment_mode="UPI",
    )
    with pytest.raises(HTTPException) as exc_info:
        submit_expense(expense_in=expense_data, db=db, current_user=None)
    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail


def test_submit_expense_mismatched_project_ngo(db, sample_ngo, sample_project):
    """Verify error raised if project belongs to another NGO."""
    ngo2 = NGO(
        name="Other NGO",
        registration_number="MH-OTH-2024-001",
        contact_email="oth@example.org",
        contact_phone="+91-1122334455",
        is_active=True,
    )
    db.add(ngo2)
    db.commit()
    db.refresh(ngo2)

    expense_data = ExpenseCreate(
        title="Cross Project Expense",
        category="Materials",
        amount=12000.0,
        ngo_id=ngo2.id,
        project_id=sample_project.id,
    )
    with pytest.raises(HTTPException) as exc_info:
        submit_expense(expense_in=expense_data, db=db, current_user=None)
    assert exc_info.value.status_code == 400
    assert "does not belong to NGO" in exc_info.value.detail


def test_submit_expense_invalid_validation(sample_ngo):
    """Verify invalid category or payment mode fails schema validation."""
    with pytest.raises(ValidationError):
        ExpenseCreate(
            title="Invalid Cost",
            category="Operational",
            amount=1000.0,
            ngo_id=sample_ngo.id,
            payment_mode="BITCOIN_LIGHTNING",
        )

    with pytest.raises(ValidationError):
        ExpenseCreate(
            title="Negative Cost",
            category="Operational",
            amount=-500.0,
            ngo_id=sample_ngo.id,
            payment_mode="UPI",
        )


def test_list_expenses_and_filtering(db, sample_ngo, sample_project):
    """Verify listing expenditures with category, status, and project

    filters.
    """
    e1 = ExpenseCreate(
        title="Hardware Purchase",
        category="Hardware",
        amount=50000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        status="APPROVED",
    )
    e2 = ExpenseCreate(
        title="Teacher Workshops",
        category="Training",
        amount=25000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        status="PENDING",
    )
    submit_expense(e1, db)
    submit_expense(e2, db)

    # 1. List all
    all_exp = list_expenses(db=db)
    assert all_exp.total == 2
    assert all_exp.total_amount == 75000.0
    assert all_exp.approved_amount == 50000.0
    assert all_exp.pending_amount == 25000.0

    # 2. Filter by status
    pending_only = list_expenses(status="PENDING", db=db)
    assert pending_only.total == 1
    assert pending_only.items[0].title == "Teacher Workshops"

    # 3. Filter by category
    hw_only = list_expenses(category="Hardware", db=db)
    assert hw_only.total == 1
    assert hw_only.items[0].title == "Hardware Purchase"


def test_update_expense_details(db, sample_ngo, sample_project):
    """Verify updating expense fields."""
    expense_data = ExpenseCreate(
        title="Initial Title",
        category="Operational",
        amount=15000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        status="PENDING",
    )
    created = submit_expense(expense_data, db)

    update_in = ExpenseUpdate(
        title="Corrected Equipment Title",
        vendor_name="Nagpur Scientific Store",
        invoice_number="INV-9901",
    )
    updated = update_expense(expense_id=created.id, expense_in=update_in, db=db, current_user=None)

    assert updated.title == "Corrected Equipment Title"
    assert updated.vendor_name == "Nagpur Scientific Store"
    assert updated.invoice_number == "INV-9901"


def test_manage_expense_status_lifecycle(db, sample_ngo, sample_project):
    """Verify status audit workflow: PENDING -> APPROVED (credits balance) ->

    REJECTED (rolls back balance).
    """
    initial_project_utilized = sample_project.utilized_amount
    initial_ngo_utilized = sample_ngo.total_funds_utilized

    expense_data = ExpenseCreate(
        title="Audited Expense Item",
        category="Materials",
        amount=30000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        status="PENDING",
    )
    created = submit_expense(expense_data, db)

    # 1. Approve the expense
    status_update_app = ExpenseStatusUpdate(
        status="APPROVED",
        review_notes="All original tax invoices and physical stock verified by external auditor.",
        reviewed_by="Auditor R. Kulkarni",
    )
    approved = update_expense_status(
        expense_id=created.id,
        status_update=status_update_app,
        db=db,
        current_user=None,
    )
    assert approved.status == "APPROVED"
    assert approved.is_verified is True
    assert approved.reviewed_by == "Auditor R. Kulkarni"
    assert approved.tx_hash.startswith("0x")

    db.refresh(sample_project)
    db.refresh(sample_ngo)
    assert sample_project.utilized_amount == initial_project_utilized + 30000.0
    assert sample_ngo.total_funds_utilized == initial_ngo_utilized + 30000.0

    # 2. Reject the expense later upon compliance check
    status_update_rej = ExpenseStatusUpdate(
        status="REJECTED",
        review_notes="Duplicate bill detected on external portal.",
        reviewed_by="Compliance Lead",
    )
    rejected = update_expense_status(
        expense_id=created.id,
        status_update=status_update_rej,
        db=db,
        current_user=None,
    )
    assert rejected.status == "REJECTED"
    assert rejected.is_verified is False

    db.refresh(sample_project)
    db.refresh(sample_ngo)
    assert sample_project.utilized_amount == initial_project_utilized
    assert sample_ngo.total_funds_utilized == initial_ngo_utilized


def test_expense_stats_aggregation(db, sample_ngo, sample_project):
    """Verify aggregate expense statistics and category distribution."""
    e1 = ExpenseCreate(
        title="Solar Panels",
        category="Hardware",
        amount=60000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        status="APPROVED",
    )
    e2 = ExpenseCreate(
        title="Consultancy",
        category="Services",
        amount=20000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        status="PENDING",
    )
    submit_expense(e1, db)
    submit_expense(e2, db)

    stats = get_expense_statistics(ngo_id=sample_ngo.id, db=db)
    assert stats.total_expenses_count == 2
    assert stats.total_amount == 80000.0
    assert stats.approved_amount == 60000.0
    assert stats.pending_amount == 20000.0
    assert len(stats.by_category) == 2


def test_delete_expense_rollback(db, sample_ngo, sample_project):
    """Verify deleting an approved expense deducts the utilization balance."""
    expense_data = ExpenseCreate(
        title="Deletable Cost",
        category="Operational",
        amount=15000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        status="APPROVED",
    )
    created = submit_expense(expense_data, db)

    db.refresh(sample_project)
    db.refresh(sample_ngo)
    proj_before_delete = sample_project.utilized_amount
    ngo_before_delete = sample_ngo.total_funds_utilized

    # Delete
    res = delete_expense(expense_id=created.id, db=db, current_user=None)
    assert res["success"] is True

    db.refresh(sample_project)
    db.refresh(sample_ngo)
    assert sample_project.utilized_amount == proj_before_delete - 15000.0
    assert sample_ngo.total_funds_utilized == ngo_before_delete - 15000.0
    assert db.query(Expense).filter(Expense.id == created.id, Expense.is_active == True).first() is None

