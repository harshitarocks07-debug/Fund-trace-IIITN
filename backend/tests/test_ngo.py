import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

from app.db.base import Base
from app.models.ngo import NGO
from app.schemas.ngo import (
    NGOCreate,
    NGOUpdate,
    NGOStatusUpdate,
)
from app.api.v1.endpoints.ngo import (
    list_ngos,
    create_ngo,
    get_ngo_profile,
    update_ngo_profile,
    update_ngo_verification_status,
    get_ngo_statistics,
    delete_ngo_profile,
)
from app.services import ngo_service

# Setup in-memory test database with StaticPool
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


def test_create_and_get_ngo(db):
    payload = NGOCreate(
        name="Pratham Shiksha Trust",
        legal_name="Pratham Shiksha National Trust",
        registration_number="MH-2024-TEST-001",
        darpan_id="MH/2024/0998877",
        pan_number="AAATP9988Z",
        category="Education",
        mission="Empowering every child with foundational literacy.",
        contact_email="contact@prathamtest.org",
        contact_phone="+91-9988776655",
        website="https://prathamtest.org",
        city="Nagpur",
        state="Maharashtra",
        has_80g_certificate=True,
        has_12a_certificate=True,
        wallet_address="0x1234567890abcdef1234567890abcdef12345678",
    )

    # 1. Create NGO via endpoint
    created = create_ngo(ngo_in=payload, db=db, current_user=None)
    assert created.id is not None
    assert created.name == "Pratham Shiksha Trust"
    assert created.registration_number == "MH-2024-TEST-001"
    assert created.verification_status == "PENDING"
    assert created.transparency_score >= 65.0

    # 2. Get NGO by ID via endpoint
    fetched = get_ngo_profile(ngo_id=created.id, db=db)
    assert fetched.id == created.id
    assert fetched.city == "Nagpur"
    assert fetched.category == "Education"


def test_duplicate_registration_number_rejected(db):
    payload = NGOCreate(
        name="First NGO",
        registration_number="UNIQUE-REG-123",
        category="Healthcare",
        contact_email="first@ngo.org",
        contact_phone="+91-1111111111",
    )
    create_ngo(ngo_in=payload, db=db, current_user=None)

    # Attempting duplicate registration must raise HTTPException with 400
    with pytest.raises(HTTPException) as exc_info:
        create_ngo(ngo_in=payload, db=db, current_user=None)
    assert exc_info.value.status_code == 400
    assert "already exists" in str(exc_info.value.detail)


def test_list_and_filter_ngos(db):
    ngo1 = NGOCreate(
        name="Alpha Health Care",
        registration_number="REG-HEALTH-001",
        category="Healthcare",
        city="Mumbai",
        contact_email="alpha@health.org",
        contact_phone="+91-2222222222",
    )
    ngo2 = NGOCreate(
        name="Beta Green Foundation",
        registration_number="REG-ENV-002",
        category="Environment",
        city="Pune",
        contact_email="beta@green.org",
        contact_phone="+91-3333333333",
    )
    create_ngo(ngo_in=ngo1, db=db)
    create_ngo(ngo_in=ngo2, db=db)

    # Filter by category
    res_health = list_ngos(category="Healthcare", db=db)
    assert res_health.total == 1
    assert res_health.items[0].name == "Alpha Health Care"

    # Search by text
    res_search = list_ngos(search="Green", db=db)
    assert res_search.total == 1
    assert res_search.items[0].name == "Beta Green Foundation"


def test_update_ngo_profile(db):
    ngo = NGOCreate(
        name="Original Name",
        registration_number="REG-UPD-001",
        category="Education",
        contact_email="orig@test.org",
        contact_phone="+91-4444444444",
    )
    created = create_ngo(ngo_in=ngo, db=db)

    update_payload = NGOUpdate(
        name="Updated Organization Name",
        mission="Newly updated mission statement",
        website="https://newsite.org",
    )
    updated = update_ngo_profile(ngo_id=created.id, ngo_in=update_payload, db=db)
    assert updated.name == "Updated Organization Name"
    assert updated.mission == "Newly updated mission statement"
    assert updated.website == "https://newsite.org"


def test_update_verification_status_and_stats(db):
    ngo = NGOCreate(
        name="Audit Test NGO",
        registration_number="REG-AUD-001",
        category="Rural Development",
        contact_email="aud@test.org",
        contact_phone="+91-5555555555",
        has_80g_certificate=True,
        has_12a_certificate=True,
    )
    created = create_ngo(ngo_in=ngo, db=db)
    initial_score = created.transparency_score

    # Verify status change to VERIFIED
    status_payload = NGOStatusUpdate(
        verification_status="VERIFIED",
        verification_notes="All audited statutory documents meet standards.",
    )
    verified = update_ngo_verification_status(
        ngo_id=created.id,
        status_in=status_payload,
        db=db,
    )
    assert verified.verification_status == "VERIFIED"
    assert verified.verification_notes == "All audited statutory documents meet standards."
    assert verified.verified_at is not None
    assert verified.transparency_score > initial_score

    # Check stats calculation
    stats = get_ngo_statistics(ngo_id=created.id, db=db)
    assert stats["name"] == "Audit Test NGO"
    assert stats["verification_status"] == "VERIFIED"
    assert stats["compliance"]["has_80g"] is True


def test_soft_delete_ngo(db):
    ngo = NGOCreate(
        name="Deactivation Test NGO",
        registration_number="REG-DEL-001",
        category="Disaster Relief",
        contact_email="del@test.org",
        contact_phone="+91-6666666666",
    )
    created = create_ngo(ngo_in=ngo, db=db)

    # Deactivate NGO
    del_res = delete_ngo_profile(ngo_id=created.id, db=db)
    assert del_res["status"] == "success"

    # Confirm it's no longer returned in active list
    all_ngos = list_ngos(db=db)
    assert not any(n.id == created.id for n in all_ngos.items)

