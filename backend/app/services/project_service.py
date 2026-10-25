import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Union
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models.project import Project
from app.models.ngo import NGO
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectStatusUpdate,
    ProjectResponse,
    ProjectBudgetSummary,
)


def compute_project_metrics(project: Project) -> dict:
    """Computes real-time financial progress and budget metrics."""
    target = project.target_budget if project.target_budget and project.target_budget > 0 else (project.budget or 1.0)
    raised = project.raised_amount or project.raised or 0.0
    funding_pct = round((raised / target) * 100, 2)

    utilization_pct = 0.0
    if raised > 0:
        utilization_pct = round((project.utilized_amount / raised) * 100, 2)

    remaining = max(0.0, round(target - raised, 2))
    ngo_name = project.ngo.name if getattr(project, "ngo", None) and hasattr(project.ngo, "name") else (project.ngo or "Helping Hands Foundation")

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
        title=project.title or project.name or "",
        name=project.name or project.title or "",
        ngo=project.ngo or metrics["ngo_name"] or "Helping Hands Foundation",
        budget=project.budget or project.target_budget or 0.0,
        raised=project.raised or project.raised_amount or 0.0,
        description=project.description,
        category=project.category,
        target_budget=project.target_budget or project.budget or 0.0,
        raised_amount=project.raised_amount or project.raised or 0.0,
        utilized_amount=project.utilized_amount or 0.0,
        status=project.status or "PLANNING",
        start_date=project.start_date,
        end_date=project.end_date,
        location=project.location or "India",
        beneficiaries_target=project.beneficiaries_target or 0,
        beneficiaries_reached=project.beneficiaries_reached or 0,
        milestones=project.milestones,
        wallet_address=project.wallet_address,
        is_active=project.is_active if project.is_active is not None else True,
        created_at=project.created_at,
        updated_at=project.updated_at,
        ngo_name=metrics["ngo_name"],
        funding_progress_pct=metrics["funding_progress_pct"],
        budget_utilization_pct=metrics["budget_utilization_pct"],
        remaining_budget=metrics["remaining_budget"],
    )


def create_project(db: Session, project_in: ProjectCreate, current_user: Optional[User] = None) -> Project:
    # 1. Verify parent NGO if specified
    ngo = None
    if project_in.ngo_id:
        ngo = db.query(NGO).filter(NGO.id == project_in.ngo_id, NGO.is_active == True).first()
        if not ngo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent NGO with ID {project_in.ngo_id} not found or inactive."
            )
    else:
        ngo = db.query(NGO).filter(NGO.is_active == True).first()

    # 2. Validate budget
    budget_val = project_in.target_budget or project_in.budget or 0.0
    if budget_val <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project target budget must be greater than zero."
        )

    existing_count = db.query(Project).count()
    project_id = f"PRJ-{str(existing_count + 1).zfill(3)}"

    project_data = project_in.model_dump(exclude_unset=True)
    project_data["id"] = project_id
    if ngo and "ngo_id" not in project_data:
        project_data["ngo_id"] = ngo.id

    if current_user:
        project_data["created_by_id"] = current_user.id
        if not project_data.get("ngo"):
            project_data["ngo"] = getattr(current_user, "organization", None) or current_user.full_name

    project = Project(**project_data)

    if ngo and project.status.upper() == "ACTIVE":
        ngo.active_projects_count = (ngo.active_projects_count or 0) + 1

    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project_by_id(db: Session, project_id: Union[str, int]) -> Optional[Project]:
    pid = str(project_id)
    return db.query(Project).filter(Project.id == pid, Project.is_active == True).first()


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
        query = query.filter(or_(Project.category.ilike(category), Project.category == category))

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Project.title.ilike(search_pattern),
                Project.name.ilike(search_pattern),
                Project.description.ilike(search_pattern),
                Project.location.ilike(search_pattern),
            )
        )

    total = query.count()
    items = query.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def update_project(db: Session, project_id: Union[str, int], project_in: ProjectUpdate) -> Project:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    update_dict = project_in.model_dump(exclude_unset=True)

    if "target_budget" in update_dict and update_dict["target_budget"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project target budget must be greater than zero."
        )

    for field, value in update_dict.items():
        setattr(project, field, value)

    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


def update_project_status(db: Session, project_id: Union[str, int], status_in: ProjectStatusUpdate) -> Project:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    prev_status = project.status.upper()
    next_status = status_in.status.upper()

    project.status = next_status
    if status_in.beneficiaries_reached is not None:
        project.beneficiaries_reached = status_in.beneficiaries_reached

    # Manage NGO active projects counter
    if project.ngo:
        if prev_status != "ACTIVE" and next_status == "ACTIVE":
            project.ngo.active_projects_count = (project.ngo.active_projects_count or 0) + 1
        elif prev_status == "ACTIVE" and next_status != "ACTIVE":
            project.ngo.active_projects_count = max(0, (project.ngo.active_projects_count or 1) - 1)

    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: Union[str, int]) -> bool:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    if project.ngo and project.status.upper() == "ACTIVE":
        project.ngo.active_projects_count = max(0, (project.ngo.active_projects_count or 1) - 1)

    project.is_active = False
    project.updated_at = datetime.utcnow()
    db.commit()
    return True


def get_project_budget_analytics(db: Session, project_id: Union[str, int]) -> ProjectBudgetSummary:
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    target = project.target_budget or project.budget or 1.0
    raised = project.raised_amount or project.raised or 0.0
    utilized = project.utilized_amount or 0.0

    funding_pct = round((raised / target) * 100, 2)
    utilization_pct = round((utilized / raised) * 100, 2) if raised > 0 else 0.0
    unutilized = max(0.0, round(raised - utilized, 2))
    budget_gap = max(0.0, round(target - raised, 2))

    return ProjectBudgetSummary(
        project_id=project.id,
        title=project.title or project.name or "",
        target_budget=target,
        raised_amount=raised,
        utilized_amount=utilized,
        funding_percentage=min(100.0, funding_pct),
        utilization_percentage=min(100.0, utilization_pct),
        unutilized_funds=unutilized,
        budget_gap=budget_gap,
        status=project.status or "PLANNING",
        beneficiaries_target=project.beneficiaries_target or 0,
        beneficiaries_reached=project.beneficiaries_reached or 0,
    )


def seed_sample_projects_if_empty(db: Session) -> None:
    if db.query(Project).count() > 0:
        return

    sample_ngo = db.query(NGO).first()
    ngo_id = sample_ngo.id if sample_ngo else None

    sample_projects = [
        Project(
            id="PRJ-001",
            ngo_id=ngo_id,
            name="Rural Digital Classrooms 2026",
            title="Rural Digital Classrooms 2026",
            description="Deploying solar-powered digital tablets and interactive projector units across rural schools.",
            category="Education",
            budget=1500000.0,
            target_budget=1500000.0,
            raised=1250000.0,
            raised_amount=1250000.0,
            utilized_amount=890000.0,
            status="ACTIVE",
            start_date=datetime.utcnow() - timedelta(days=90),
            end_date=datetime.utcnow() + timedelta(days=90),
            location="Nagpur, Maharashtra",
            beneficiaries_target=3500,
            beneficiaries_reached=2200,
            milestones="M1: Solar Unit Installs (Done), M2: Tablet Distribution (Done), M3: Teacher Training (Ongoing)",
            wallet_address="0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
            is_active=True,
        ),
        Project(
            id="PRJ-002",
            ngo_id=ngo_id,
            name="STEM Science & Robotics Kits",
            title="STEM Science & Robotics Kits",
            description="Equipping secondary school laboratories with hands-on mechanics and coding starter packages.",
            category="Education",
            budget=600000.0,
            target_budget=600000.0,
            raised=600000.0,
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
            is_active=True,
        ),
    ]

    db.add_all(sample_projects)
    if sample_ngo:
        sample_ngo.active_projects_count = 1
    db.commit()
