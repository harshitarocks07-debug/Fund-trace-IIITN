import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException
from pydantic import ValidationError

from app.db.base import Base
from app.models.ngo import NGO
from app.models.project import Project
from app.models.donation import Donation
from app.schemas.donation import DonationCreate
from app.api.v1.endpoints.donations import (
    record_donation,
    list_donations,
    get_donation,
    get_donation_receipt,
    get_donation_statistics,
    delete_donation,
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
        registration_number="MH-NGP-2024-DON1",
        darpan_id="MH/2024/0011223",
        category="Education",
        contact_email="contact@vidyajyoti.org",
        contact_phone="+91-9876543210",
        city="Nagpur",
        state="Maharashtra",
        has_80g_certificate=True,
        total_funds_received=100000.0,
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
        description="Setting up smart classrooms in rural schools.",
        category="Education",
        target_budget=500000.0,
        raised_amount=50000.0,
        utilized_amount=10000.0,
        status="ACTIVE",
        is_active=True,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def test_record_donation_associated_with_project(db, sample_ngo, sample_project):
    """Verify recording a donation associated with a project credits both

    project and NGO totals.
    """
    initial_project_raised = sample_project.raised_amount
    initial_ngo_funds = sample_ngo.total_funds_received

    donation_data = DonationCreate(
        donor_name="TechForGood CSR Trust",
        donor_email="csr@techforgood.org",
        donor_pan="AAACT8921B",
        amount=150000.0,
        currency="INR",
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        payment_method="BANK_TRANSFER",
        is_anonymous=False,
        notes="Q1 CSR Contribution for Digital Classrooms",
    )

    resp = record_donation(donation_in=donation_data, db=db, current_user=None)

    assert resp.id is not None
    assert resp.donor_name == "TechForGood CSR Trust"
    assert resp.amount == 150000.0
    assert resp.ngo_id == sample_ngo.id
    assert resp.project_id == sample_project.id
    assert resp.project_title == "Digital Classrooms Initiative"
    assert resp.status == "CONFIRMED"
    assert resp.receipt_number.startswith("REC-")
    assert resp.tx_hash.startswith("0x")
    assert resp.tax_benefit_claimed is True

    # Check project raised amount incremented
    db.refresh(sample_project)
    assert sample_project.raised_amount == initial_project_raised + 150000.0

    # Check NGO total funds incremented
    db.refresh(sample_ngo)
    assert sample_ngo.total_funds_received == initial_ngo_funds + 150000.0


def test_record_donation_general_fund(db, sample_ngo):
    """Verify recording an unallocated donation to NGO general fund (no project

    association).
    """
    initial_ngo_funds = sample_ngo.total_funds_received

    donation_data = DonationCreate(
        donor_name="Ananya Sharma",
        donor_email="ananya.sharma@gmail.com",
        donor_pan="ABCPS5678K",
        amount=25000.0,
        ngo_id=sample_ngo.id,
        project_id=None,
        payment_method="UPI",
        notes="General corpus donation",
    )

    resp = record_donation(donation_in=donation_data, db=db, current_user=None)

    assert resp.id is not None
    assert resp.project_id is None
    assert resp.project_title is None
    assert resp.amount == 25000.0

    db.refresh(sample_ngo)
    assert sample_ngo.total_funds_received == initial_ngo_funds + 25000.0


def test_record_donation_invalid_ngo(db):
    """Verify donation rejected if target NGO does not exist."""
    donation_data = DonationCreate(
        donor_name="Anonymous Donor",
        amount=5000.0,
        ngo_id=99999,
        project_id=None,
    )

    with pytest.raises(HTTPException) as exc_info:
        record_donation(donation_in=donation_data, db=db, current_user=None)
    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail


def test_record_donation_mismatched_project_ngo(db, sample_ngo, sample_project):
    """Verify donation rejected if project does not belong to specified NGO."""
    # Create second NGO
    ngo2 = NGO(
        name="Arogya Seva Trust",
        registration_number="MH-PUN-2024-DON2",
        category="Healthcare",
        contact_email="punengo@example.org",
        contact_phone="+91-9876543299",
        is_active=True,
    )
    db.add(ngo2)
    db.commit()
    db.refresh(ngo2)

    # Attempt to associate sample_project (which belongs to sample_ngo) with ngo2
    donation_data = DonationCreate(
        donor_name="Mismatch Test Donor",
        amount=10000.0,
        ngo_id=ngo2.id,
        project_id=sample_project.id,
    )

    with pytest.raises(HTTPException) as exc_info:
        record_donation(donation_in=donation_data, db=db, current_user=None)
    assert exc_info.value.status_code == 400
    assert "does not belong to NGO" in exc_info.value.detail


def test_record_donation_invalid_payment_method(sample_ngo):
    """Verify invalid payment method fails schema validation."""
    with pytest.raises(ValidationError):
        DonationCreate(
            donor_name="Invalid Payment",
            amount=1000.0,
            ngo_id=sample_ngo.id,
            payment_method="GOLD_COINS",
        )


def test_list_donations_filtering(db, sample_ngo, sample_project):
    """Verify filtering donations by project, NGO, and search terms."""
    # Create another project
    project2 = Project(
        ngo_id=sample_ngo.id,
        title="Mobile Medical Van",
        category="Healthcare",
        target_budget=300000.0,
        status="ACTIVE",
    )
    db.add(project2)
    db.commit()
    db.refresh(project2)

    # Add donations
    d1 = DonationCreate(
        donor_name="Ramesh Gupta",
        amount=20000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        payment_method="UPI",
    )
    d2 = DonationCreate(
        donor_name="Pooja Patel",
        amount=30000.0,
        ngo_id=sample_ngo.id,
        project_id=project2.id,
        payment_method="CARD",
    )
    record_donation(d1, db)
    record_donation(d2, db)

    # 1. List all
    all_donations = list_donations(db=db)
    assert all_donations.total == 2
    assert all_donations.total_amount == 50000.0

    # 2. Filter by project 1
    proj1_donations = list_donations(project_id=sample_project.id, db=db)
    assert proj1_donations.total == 1
    assert proj1_donations.items[0].donor_name == "Ramesh Gupta"

    # 3. Filter by search
    searched = list_donations(search="Pooja", db=db)
    assert searched.total == 1
    assert searched.items[0].donor_name == "Pooja Patel"


def test_donation_receipt_generation(db, sample_ngo, sample_project):
    """Verify statutory 80G tax receipt generation."""
    donation_data = DonationCreate(
        donor_name="Sunil Mittal",
        donor_email="sunil.mittal@corp.com",
        donor_pan="AALPM1234F",
        amount=75000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
        payment_method="BANK_TRANSFER",
    )
    created = record_donation(donation_data, db)

    receipt = get_donation_receipt(donation_id=created.id, db=db)
    assert receipt.receipt_number == created.receipt_number
    assert receipt.donor_name == "Sunil Mittal"
    assert receipt.donor_pan == "AALPM1234F"
    assert receipt.amount == 75000.0
    assert receipt.ngo_name == sample_ngo.name
    assert receipt.has_80g_certificate is True
    assert receipt.project_title == sample_project.title
    assert "verify?hash=" in receipt.verification_link


def test_donation_statistics_aggregation(db, sample_ngo, sample_project):
    """Verify donation statistics calculations and project breakdown."""
    d1 = DonationCreate(
        donor_name="Donor A",
        amount=10000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
    )
    d2 = DonationCreate(
        donor_name="Donor B",
        amount=20000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
    )
    record_donation(d1, db)
    record_donation(d2, db)

    stats = get_donation_statistics(ngo_id=sample_ngo.id, db=db)
    assert stats.total_donations == 2
    assert stats.total_amount == 30000.0
    assert stats.average_amount == 15000.0
    assert stats.projects_funded_count == 1
    assert len(stats.by_project) == 1
    assert stats.by_project[0]["project_title"] == "Digital Classrooms Initiative"
    assert stats.by_project[0]["raised_from_donations"] == 30000.0


def test_delete_donation_rollback(db, sample_ngo, sample_project):
    """Verify deleting a donation rolls back the project and NGO balances."""
    donation_data = DonationCreate(
        donor_name="Refundable Donor",
        amount=50000.0,
        ngo_id=sample_ngo.id,
        project_id=sample_project.id,
    )
    created = record_donation(donation_data, db)

    db.refresh(sample_project)
    db.refresh(sample_ngo)
    project_raised_with_donation = sample_project.raised_amount
    ngo_total_with_donation = sample_ngo.total_funds_received

    # Now delete
    res = delete_donation(donation_id=created.id, db=db)
    assert res["success"] is True

    db.refresh(sample_project)
    db.refresh(sample_ngo)
    assert sample_project.raised_amount == project_raised_with_donation - 50000.0
    assert sample_ngo.total_funds_received == ngo_total_with_donation - 50000.0

    # Ensure soft-deleted
    assert db.query(Donation).filter(Donation.id == created.id, Donation.is_active == True).first() is None

