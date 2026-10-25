from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models.project import Project
from app.models.ngo import NGO
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectStatusUpdate,
    ProjectResponse,
    ProjectBudgetSummary,
)


def compute_project_metrics(project: Project) -> dict:
    """Computes real-time financial progress and budget metrics."""
    target = project.target_budget if project.target_budget and project.target_budget > 0 else 1.0
    funding_pct = round((project.raised_amount / target) * 100, 2)
    
    utilization_pct = 0.0
    if project.raised_amount and project.raised_amount > 0:
        utilization_pct = round((project.utilized_amount / project.raised_amount) * 100, 2)
    
    remaining = max(0.0, round(project.target_budget - project.raised_amount, 2))

    ngo_name = project.ngo.name if project.ngo else None

    return {
        "funding_progress_pct": min(100.0, funding_pct),
        "budget_utilization_pct": min(100.0, utilization_pct),
        "remaining_budget": remaining,
        "ngo_name": ngo_name,
    }


def to_project_response(project: Project) -> ProjectResponse:
    metrics = compute_project_metrics(project)
    return ProjectResponse(
        id=project.id,
        ngo_id=project.ngo_id,
        title=project.title,
        description=project.description,
        category=project.category,
        target_budget=project.target_budget,
        raised_amount=project.raised_amount,
        utilized_amount=project.utilized_amount,
        status=project.status,
        start_date=project.start_date,
        end_date=project.end_date,
        location=project.location,
        beneficiaries_target=project.beneficiaries_target,
        beneficiaries_reached=project.beneficiaries_reached,
        milestones=project.milestones,
        wallet_address=project.wallet_address,
        is_active=project.is_active,
        created_at=project.created_at,
        updated_at=project.updated_at,
        ngo_name=metrics["ngo_name"],
        funding_progress_pct=metrics["funding_progress_pct"],
        budget_utilization_pct=metrics["budget_utilization_pct"],
        remaining_budget=metrics["remaining_budget"],
    )


def create_project(db: Session, project_in: ProjectCreate) -> Project:
    # 1. Verify parent NGO exists
    ngo = db.query(NGO).filter(NGO.id == project_in.ngo_id, NGO.is_active == True).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent NGO with ID {project_in.ngo_id} not found or inactive."
        )

    # 2. Validate budget
    if project_in.target_budget <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project target budget must be greater than zero."
        )

    # 3. Create Project record
    project_data = project_in.model_dump()
    project = Project(**project_data)

    # 4. If status is ACTIVE, increment NGO active project counter
    if project.status.upper() == "ACTIVE":
        ngo.active_projects_count = (ngo.active_projects_count or 0) + 1

    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project_by_id(db: Session, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id, Project.is_active == True).first()


def list_projects(
    db: Session,
    ngo_id: Optional[int] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Project], int]:
    query = db.query(Project).filter(Project.is_active == True)

    if ngo_id is not None:
        query = query.filter(Project.ngo_id == ngo_id)

    if status and status.lower() != "all":
        query = query.filter(Project.status == status.upper())

    if category and category.lower() != "all":
        query = query.filter(Project.category.ilike(category))

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Project.title.ilike(search_filter),
                Project.description.ilike(search_filter),
                Project.location.ilike(search_filter),
            )
        )

    total = query.count()
    items = query.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def update_project(db: Session, project_id: int, project_in: ProjectUpdate) -> Project:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    update_data = project_in.model_dump(exclude_unset=True)

    # Check status transition to update NGO active counter
    old_status = project.status.upper()
    new_status = update_data.get("status")

    for key, value in update_data.items():
        setattr(project, key, value)

    if new_status and new_status.upper() != old_status:
        ngo = project.ngo
        if ngo:
            if new_status.upper() == "ACTIVE" and old_status != "ACTIVE":
                ngo.active_projects_count = (ngo.active_projects_count or 0) + 1
            elif old_status == "ACTIVE" and new_status.upper() != "ACTIVE":
                ngo.active_projects_count = max(0, (ngo.active_projects_count or 1) - 1)

    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


def update_project_status(db: Session, project_id: int, status_in: ProjectStatusUpdate) -> Project:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    norm_status = status_in.status.upper()
    valid_statuses = ["PLANNING", "ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"]
    if norm_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_in.status}'. Must be one of: {valid_statuses}"
        )

    old_status = project.status.upper()
    project.status = norm_status

    if status_in.beneficiaries_reached is not None:
        project.beneficiaries_reached = status_in.beneficiaries_reached
        # Update parent NGO total beneficiaries if increased
        if project.ngo:
            project.ngo.beneficiaries_count = (project.ngo.beneficiaries_count or 0) + status_in.beneficiaries_reached

    # Update active project counts on parent NGO
    if project.ngo:
        if norm_status == "ACTIVE" and old_status != "ACTIVE":
            project.ngo.active_projects_count = (project.ngo.active_projects_count or 0) + 1
        elif old_status == "ACTIVE" and norm_status != "ACTIVE":
            project.ngo.active_projects_count = max(0, (project.ngo.active_projects_count or 1) - 1)

    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


def get_project_budget_analytics(db: Session, project_id: int) -> ProjectBudgetSummary:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    target = project.target_budget if project.target_budget > 0 else 1.0
    funding_pct = round((project.raised_amount / target) * 100, 2)

    util_pct = 0.0
    if project.raised_amount > 0:
        util_pct = round((project.utilized_amount / project.raised_amount) * 100, 2)

    unutilized = max(0.0, round(project.raised_amount - project.utilized_amount, 2))
    gap = max(0.0, round(project.target_budget - project.raised_amount, 2))

    return ProjectBudgetSummary(
        project_id=project.id,
        title=project.title,
        target_budget=project.target_budget,
        raised_amount=project.raised_amount,
        utilized_amount=project.utilized_amount,
        funding_percentage=funding_pct,
        utilization_percentage=util_pct,
        unutilized_funds=unutilized,
        budget_gap=gap,
        status=project.status,
        beneficiaries_target=project.beneficiaries_target,
        beneficiaries_reached=project.beneficiaries_reached,
    )


def delete_project(db: Session, project_id: int) -> bool:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    if project.status == "ACTIVE" and project.ngo:
        project.ngo.active_projects_count = max(0, (project.ngo.active_projects_count or 1) - 1)

    project.is_active = False
    project.updated_at = datetime.utcnow()
    db.commit()
    return True


def seed_sample_projects_if_empty(db: Session):
    count = db.query(Project).count()
    if count > 0:
        return

    # Look up sample NGOs to associate projects with
    ngos = db.query(NGO).limit(3).all()
    if not ngos:
        return

    sample_projects = [
        Project(
            ngo_id=ngos[0].id,
            title="Rural Digital Classrooms 2026",
            description="Deploying solar-powered digital tablets, educational software, and interactive projector units across 28 rural Zilla Parishad schools in Vidarbha.",
            category="Education",
            target_budget=1500000.0,
            raised_amount=1250000.0,
            utilized_amount=890000.0,
            status="ACTIVE",
            start_date=datetime.utcnow() - timedelta(days=90),
            end_date=datetime.utcnow() + timedelta(days=90),
            location="Nagpur & Wardha, Maharashtra",
            beneficiaries_target=3500,
            beneficiaries_reached=2200,
            milestones="M1: Solar Unit Installs (Done), M2: Tablet Distribution (Done), M3: Teacher Pedagogy Training (Ongoing)",
            wallet_address="0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
        ),
        Project(
            ngo_id=ngos[0].id,
            title="STEM Science & Robotics Kits",
            description="Equipping secondary school student laboratories with hands-on mechanics, electronics, and coding starter packages.",
            category="Education",
            target_budget=600000.0,
            raised_amount=600000.0,
            utilized_amount=600000.0,
            status="COMPLETED",
            start_date=datetime.utcnow() - timedelta(days=180),
            end_date=datetime.utcnow() - timedelta(days=20),
            location="Bhandara, Maharashtra",
            beneficiaries_target=1200,
            beneficiaries_reached=1250,
            milestones="Procurement (Done), Delivery (Done), Teacher Workshops (Done), Final Audit (Done)",
            wallet_address="0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
        ),
        Project(
            ngo_id=ngos[1].id if len(ngos) > 1 else ngos[0].id,
            title="Mobile Diagnostic Health Van Fleet",
            description="Deploying tele-diagnostic medical vans with ECG, CBC analysis, and blood glucose meters to tribal communities.",
            category="Healthcare",
            target_budget=2400000.0,
            raised_amount=2100000.0,
            utilized_amount=1750000.0,
            status="ACTIVE",
            start_date=datetime.utcnow() - timedelta(days=120),
            end_date=datetime.utcnow() + timedelta(days=60),
            location="Mewat & Alwar Districts",
            beneficiaries_target=15000,
            beneficiaries_reached=11800,
            milestones="Vehicle Customization (Done), Medical Device Setup (Done), Community Camps (Ongoing)",
            wallet_address="0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB",
        ),
        Project(
            ngo_id=ngos[2].id if len(ngos) > 2 else ngos[0].id,
            title="Western Ghats Agro-Forestry Corridor",
            description="Planting 100,000 indigenous fruit-bearing and endemic tree saplings with geo-tagged survival verification.",
            category="Environment",
            target_budget=1200000.0,
            raised_amount=450000.0,
            utilized_amount=200000.0,
            status="PLANNING",
            start_date=datetime.utcnow() + timedelta(days=15),
            end_date=datetime.utcnow() + timedelta(days=200),
            location="Coorg & Wayanad",
            beneficiaries_target=5000,
            beneficiaries_reached=0,
            milestones="Nursery Prep (Ongoing), Community Land Demarcation (Done), Sapling Plantation (Pending)",
            wallet_address="0x0D8775F648430679A709E98d2b0Cb6250d2887EF",
        ),
    ]

    for p in sample_projects:
        db.add(p)
    db.commit()

