import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

from app.db.base import Base
from app.models.ngo import NGO
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectStatusUpdate,
)
from app.api.v1.endpoints.projects import (
    create_project,
    list_projects,
    get_project,
    update_project,
    update_project_status,
    get_project_budget,
    delete_project,
)

# Setup in-memory SQLite database
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
        name="Pratham Shiksha Trust",
        registration_number="MH-2024-TEST-PRJ",
        category="Education",
        contact_email="test@pratham.org",
        contact_phone="+91-9988776655",
        active_projects_count=0,
    )
    db.add(ngo)
    db.commit()
    db.refresh(ngo)
    return ngo


def test_create_and_get_project(db, sample_ngo):
    payload = ProjectCreate(
        ngo_id=sample_ngo.id,
        title="Smart Lab Classrooms",
        description="Deploying 20 computer labs in municipal schools.",
        category="Education",
        target_budget=800000.0,
        status="ACTIVE",
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow() + timedelta(days=120),
        location="Nagpur, Maharashtra",
        beneficiaries_target=1500,
        milestones="M1: Hardware Setup, M2: Courseware Launch",
        wallet_address="0x1111222233334444555566667777888899990000",
    )

    created = create_project(project_in=payload, db=db, current_user=None)
    assert created.id is not None
    assert created.title == "Smart Lab Classrooms"
    assert created.target_budget == 800000.0
    assert created.status == "ACTIVE"
    assert created.ngo_name == "Pratham Shiksha Trust"

    # Verify parent NGO active project count incremented
    db.refresh(sample_ngo)
    assert sample_ngo.active_projects_count == 1

    # Fetch by ID
    fetched = get_project(project_id=created.id, db=db)
    assert fetched.id == created.id
    assert fetched.location == "Nagpur, Maharashtra"
    assert fetched.remaining_budget == 800000.0


def test_create_project_invalid_ngo(db):
    payload = ProjectCreate(
        ngo_id=99999,  # Non-existent NGO
        title="Orphan Project",
        category="Education",
        target_budget=100000.0,
    )
    with pytest.raises(HTTPException) as exc:
        create_project(project_in=payload, db=db, current_user=None)
    assert exc.value.status_code == 404
    assert "not found" in str(exc.value.detail).lower()


def test_create_project_invalid_budget(db, sample_ngo):
    # Target budget must be greater than 0
    with pytest.raises(Exception):
        ProjectCreate(
            ngo_id=sample_ngo.id,
            title="Zero Budget Project",
            category="Education",
            target_budget=0.0,
        )


def test_list_and_filter_projects(db, sample_ngo):
    p1 = ProjectCreate(
        ngo_id=sample_ngo.id,
        title="Clean Drinking Water Units",
        category="Healthcare",
        target_budget=300000.0,
        status="ACTIVE",
        location="Gadchiroli",
    )
    p2 = ProjectCreate(
        ngo_id=sample_ngo.id,
        title="Reforest Hill Slopes",
        category="Environment",
        target_budget=450000.0,
        status="PLANNING",
        location="Melghat",
    )
    create_project(project_in=p1, db=db)
    create_project(project_in=p2, db=db)

    # Filter by category
    res_health = list_projects(category="Healthcare", db=db)
    assert res_health.total == 1
    assert res_health.items[0].title == "Clean Drinking Water Units"

    # Filter by status
    res_planning = list_projects(status="PLANNING", db=db)
    assert res_planning.total == 1
    assert res_planning.items[0].title == "Reforest Hill Slopes"

    # Search by text
    res_search = list_projects(search="Water", db=db)
    assert res_search.total == 1
    assert res_search.items[0].title == "Clean Drinking Water Units"


def test_update_project_details_and_budget(db, sample_ngo):
    p = ProjectCreate(
        ngo_id=sample_ngo.id,
        title="Initial Title",
        target_budget=500000.0,
        status="PLANNING",
    )
    created = create_project(project_in=p, db=db)

    update_in = ProjectUpdate(
        title="Expanded Digital Lab Title",
        target_budget=750000.0,
        raised_amount=300000.0,
        utilized_amount=150000.0,
    )
    updated = update_project(project_id=created.id, project_in=update_in, db=db)
    assert updated.title == "Expanded Digital Lab Title"
    assert updated.target_budget == 750000.0
    assert updated.raised_amount == 300000.0
    assert updated.utilized_amount == 150000.0
    assert updated.funding_progress_pct == 40.0
    assert updated.budget_utilization_pct == 50.0


def test_update_project_status_lifecycle(db, sample_ngo):
    p = ProjectCreate(
        ngo_id=sample_ngo.id,
        title="Village Library Setup",
        target_budget=200000.0,
        status="PLANNING",
    )
    created = create_project(project_in=p, db=db)
    assert sample_ngo.active_projects_count == 0

    # 1. Transition PLANNING -> ACTIVE
    status_active = ProjectStatusUpdate(status="ACTIVE")
    res1 = update_project_status(project_id=created.id, status_in=status_active, db=db)
    assert res1.status == "ACTIVE"
    db.refresh(sample_ngo)
    assert sample_ngo.active_projects_count == 1

    # 2. Transition ACTIVE -> COMPLETED with beneficiaries
    status_completed = ProjectStatusUpdate(status="COMPLETED", beneficiaries_reached=450)
    res2 = update_project_status(project_id=created.id, status_in=status_completed, db=db)
    assert res2.status == "COMPLETED"
    assert res2.beneficiaries_reached == 450
    db.refresh(sample_ngo)
    assert sample_ngo.active_projects_count == 0


def test_project_budget_analytics(db, sample_ngo):
    p = ProjectCreate(
        ngo_id=sample_ngo.id,
        title="Solar Lighting Grid",
        target_budget=1000000.0,
        status="ACTIVE",
    )
    created = create_project(project_in=p, db=db)

    # Simulate donations raised and expenses utilized
    update_in = ProjectUpdate(
        raised_amount=600000.0,
        utilized_amount=400000.0,
    )
    update_project(project_id=created.id, project_in=update_in, db=db)

    summary = get_project_budget(project_id=created.id, db=db)
    assert summary.target_budget == 1000000.0
    assert summary.raised_amount == 600000.0
    assert summary.utilized_amount == 400000.0
    assert summary.funding_percentage == 60.0
    assert summary.utilization_percentage == 66.67
    assert summary.unutilized_funds == 200000.0
    assert summary.budget_gap == 400000.0


def test_soft_delete_project(db, sample_ngo):
    p = ProjectCreate(
        ngo_id=sample_ngo.id,
        title="Cancelled Construction",
        target_budget=250000.0,
        status="ACTIVE",
    )
    created = create_project(project_in=p, db=db)
    db.refresh(sample_ngo)
    assert sample_ngo.active_projects_count == 1

    delete_project(project_id=created.id, db=db)

    # Active count decremented
    db.refresh(sample_ngo)
    assert sample_ngo.active_projects_count == 0

    # Project not returned in active list
    all_projects = list_projects(db=db)
    assert not any(item.id == created.id for item in all_projects.items)

