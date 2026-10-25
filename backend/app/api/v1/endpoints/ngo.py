from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.ngo import NGO
from app.schemas.ngo import (
    NGOCreate,
    NGOUpdate,
    NGOStatusUpdate,
    NGOResponse,
    NGOListResponse,
    NGOStats,
)
from app.services import ngo_service
from app.core.permissions import get_current_user, get_current_active_user, require_roles

router = APIRouter()


@router.get("/", response_model=NGOListResponse, summary="List NGOs with search and filters")
def list_ngos(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    items, total = ngo_service.list_ngos(
        db=db,
        search=search,
        category=category,
        verification_status=status,
        city=city,
        skip=skip,
        limit=limit,
    )
    return NGOListResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("/", response_model=NGOResponse, status_code=status.HTTP_201_CREATED, summary="Register a new NGO profile")
def create_ngo(
    ngo_in: NGOCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    user_id = current_user.id if isinstance(current_user, User) else ngo_in.user_id
    new_ngo = ngo_service.create_ngo(db=db, ngo_in=ngo_in, user_id=user_id)
    return new_ngo


@router.get("/me", response_model=NGOResponse, summary="Get the current logged-in NGO's profile")
def get_my_ngo_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ngo = ngo_service.get_ngo_by_user_id(db=db, user_id=current_user.id)
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No NGO profile registered for the current user.",
        )
    return ngo


@router.put("/me", response_model=NGOResponse, summary="Update the current logged-in NGO's profile")
def update_my_ngo_profile(
    ngo_in: NGOUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ngo = ngo_service.get_ngo_by_user_id(db=db, user_id=current_user.id)
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No NGO profile registered for the current user to update.",
        )
    updated = ngo_service.update_ngo(db=db, ngo_id=ngo.id, ngo_in=ngo_in)
    return updated


@router.get("/{ngo_id}", response_model=NGOResponse, summary="Get NGO profile details by ID")
def get_ngo_profile(
    ngo_id: int,
    db: Session = Depends(get_db),
):
    ngo = ngo_service.get_ngo_by_id(db=db, ngo_id=ngo_id)
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NGO with ID {ngo_id} not found.",
        )
    return ngo


@router.put("/{ngo_id}", response_model=NGOResponse, summary="Update NGO profile by ID")
def update_ngo_profile(
    ngo_id: int,
    ngo_in: NGOUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    # In a real environment, verify that current_user is either the NGO owner or has role admin/auditor
    updated = ngo_service.update_ngo(db=db, ngo_id=ngo_id, ngo_in=ngo_in)
    return updated


@router.patch("/{ngo_id}/status", response_model=NGOResponse, summary="Update NGO verification status (Auditor/Admin)")
def update_ngo_verification_status(
    ngo_id: int,
    status_in: NGOStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    auditor_id = current_user.id if isinstance(current_user, User) else None
    updated = ngo_service.update_ngo_status(
        db=db,
        ngo_id=ngo_id,
        status_in=status_in,
        auditor_id=auditor_id,
    )
    return updated


@router.get("/{ngo_id}/stats", response_model=NGOStats, summary="Get NGO financial & impact statistics")
def get_ngo_statistics(
    ngo_id: int,
    db: Session = Depends(get_db),
):
    stats = ngo_service.get_ngo_statistics(db=db, ngo_id=ngo_id)
    return stats


@router.delete("/{ngo_id}", summary="Deactivate an NGO profile")
def delete_ngo_profile(
    ngo_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    success = ngo_service.delete_ngo(db=db, ngo_id=ngo_id)
    return {"status": "success", "message": f"NGO {ngo_id} deactivated successfully"}
