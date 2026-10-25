from typing import Optional, List, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectStatusUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectBudgetSummary,
)
from app.services import project_service
from app.core.permissions import get_current_user, require_ngo_admin

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, summary="Create a new project with budget")
@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Create a new project. Enforces role restrictions if an authenticated user is provided."""
    if current_user is not None and getattr(current_user, "role", None):
        if UserRole.normalize(current_user.role) != UserRole.NGO_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: role '{current_user.role}' is not authorized for this action. Required role: NGO admin"
            )

    project = project_service.create_project(db=db, project_in=project_in, current_user=current_user)
    return project_service.to_project_response(project)


@router.get("", response_model=ProjectListResponse, summary="List projects with filtering and search")
@router.get("/", response_model=ProjectListResponse, include_in_schema=False)
def list_projects(
    ngo_id: Optional[int] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    items, total = project_service.list_projects(
        db=db,
        ngo_id=ngo_id,
        status=status,
        category=category,
        search=search,
        skip=skip,
        limit=limit,
    )
    formatted = [project_service.to_project_response(p) for p in items]
    return ProjectListResponse(items=formatted, total=total, skip=skip, limit=limit)


@router.get("/{project_id}", response_model=ProjectResponse, summary="Get project profile and budget details by ID")
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    project = project_service.get_project_by_id(db=db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )
    return project_service.to_project_response(project)


@router.put("/{project_id}", response_model=ProjectResponse, summary="Update project specifications and budget")
def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    updated = project_service.update_project(db=db, project_id=project_id, project_in=project_in)
    return project_service.to_project_response(updated)


@router.patch("/{project_id}/status", response_model=ProjectResponse, summary="Track and transition project lifecycle status")
def update_project_status(
    project_id: str,
    status_in: ProjectStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    updated = project_service.update_project_status(db=db, project_id=project_id, status_in=status_in)
    return project_service.to_project_response(updated)


@router.get("/{project_id}/budget", response_model=ProjectBudgetSummary, summary="Get project budget analytics and utilization")
def get_project_budget(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    return project_service.get_project_budget_analytics(db=db, project_id=project_id)


@router.delete("/{project_id}", summary="Archive or deactivate a project")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    project_service.delete_project(db=db, project_id=project_id)
    return {"status": "success", "message": f"Project {project_id} deactivated successfully"}
