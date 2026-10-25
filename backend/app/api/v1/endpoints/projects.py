import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectOut
from app.core.permissions import get_current_user, require_ngo_admin

router = APIRouter()

@router.get("", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all projects. Accessible to any authenticated user (Donor, NGO Admin, Auditor)."""
    projects = db.query(Project).all()
    return projects

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin),
):
    """Create a new project. Strictly enforced: ONLY NGO Admins can create projects."""
    existing_count = db.query(Project).count()
    project_id = f"PRJ-{str(existing_count + 1).zfill(3)}"
    
    ngo_name = current_user.organization or current_user.full_name or "Helping Hands Foundation"
    
    project = Project(
        id=project_id,
        name=project_in.name.strip(),
        ngo=ngo_name,
        description=project_in.description.strip(),
        budget=project_in.budget,
        raised=0.0,
        location=project_in.location.strip(),
        category=project_in.category.strip(),
        created_by_id=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

