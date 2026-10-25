from datetime import datetime
from typing import Optional, Union, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import get_current_user, require_donor
from app.models.user import User, UserRole
from app.models.donation import Donation
from app.schemas.donation import (
    DonationCreate,
    DonationResponse,
    DonationListResponse,
    DonationReceipt,
    DonationStats,
    DonationOut,
)
from app.services import donation_service

router = APIRouter()


def _to_response(donation: Donation) -> DonationResponse:
    donor_display = "Confidential Donor" if donation.is_anonymous else (donation.donor_name or "Anonymous Supporter")
    date_val = str(donation.date or (donation.created_at.strftime("%Y-%m-%d") if donation.created_at else ""))
    ref_val = str(donation.reference or donation.tx_hash or "")
    proj_id_str = str(donation.project_id) if donation.project_id else None

    return DonationResponse(
        id=str(donation.id),
        donor=donor_display,
        donor_name=donor_display,
        donor_email=donation.donor_email,
        donor_pan=donation.donor_pan,
        amount=donation.amount,
        currency=donation.currency or "INR",
        ngo_id=donation.ngo_id or 1,
        project_id=proj_id_str,
        projectId=proj_id_str,
        date=date_val,
        reference=ref_val,
        payment_method=donation.payment_method or "UPI",
        is_anonymous=donation.is_anonymous,
        notes=donation.notes,
        status=donation.status or "CONFIRMED",
        tx_hash=donation.tx_hash,
        block_number=donation.block_number,
        receipt_number=donation.receipt_number,
        tax_benefit_claimed=donation.tax_benefit_claimed,
        is_active=donation.is_active,
        created_at=donation.created_at,
        updated_at=donation.updated_at,
        ngo_name=donation.ngo.name if donation.ngo else None,
        project_title=donation.project.title if (donation.project and hasattr(donation.project, "title")) else (donation.project.name if donation.project else None),
    )


@router.post("", response_model=DonationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=DonationResponse, status_code=status.HTTP_201_CREATED)
def record_donation(
    donation_in: DonationCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Record a donor contribution and optionally associate it with a specific project initiative.

    Strictly enforced: Only Donors (or unauthenticated demo/system calls) can record contributions.
    """
    if current_user is not None:
        user_role = getattr(current_user, "role", None)
        if user_role in [UserRole.NGO_ADMIN.value, UserRole.AUDITOR.value, "NGO admin", "Auditor"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Donor role required.",
            )

    donation = donation_service.record_donation(db, donation_in, current_user=current_user)
    return _to_response(donation)


@router.get("", response_model=DonationListResponse)
@router.get("/", response_model=DonationListResponse)
def list_donations(
    ngo_id: Optional[int] = None,
    project_id: Optional[Union[str, int]] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """List donations with filtering by NGO, associated project, and donor role."""
    # If a Donor is querying, filter to their contributions
    if current_user and getattr(current_user, "role", None) in [UserRole.DONOR.value, "Donor"]:
        items_query = db.query(Donation).filter(
            Donation.is_active == True,
            (Donation.donor_id == current_user.id) | (Donation.donor_name == current_user.full_name),
        )
        if project_id is not None:
            items_query = items_query.filter(Donation.project_id == str(project_id))
        total = items_query.count()
        items = items_query.order_by(Donation.created_at.desc()).offset(skip).limit(limit).all()
        total_amount = sum(d.amount for d in items)
        return DonationListResponse(
            items=[_to_response(d) for d in items],
            total=total,
            total_amount=float(total_amount),
            skip=skip,
            limit=limit,
        )

    items, total, total_amount = donation_service.list_donations(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=str(project_id) if project_id is not None else None,
        search=search if isinstance(search, str) else None,
        status_filter=status if isinstance(status, str) else None,
        payment_method=payment_method if isinstance(payment_method, str) else None,
        skip=skip if isinstance(skip, int) else 0,
        limit=limit if isinstance(limit, int) else 50,
    )
    return DonationListResponse(
        items=[_to_response(d) for d in items],
        total=total,
        total_amount=total_amount,
        skip=skip if isinstance(skip, int) else 0,
        limit=limit if isinstance(limit, int) else 50,
    )


@router.get("/stats/summary", response_model=DonationStats)
def get_donation_statistics(
    ngo_id: Optional[int] = None,
    project_id: Optional[Union[str, int]] = None,
    db: Session = Depends(get_db),
):
    """Retrieve high-level donation stats, volume by project, and monthly trends."""
    return donation_service.get_donation_stats(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=str(project_id) if project_id is not None else None,
    )


@router.get("/{donation_id}", response_model=DonationResponse)
def get_donation(
    donation_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve details for a single donation."""
    donation = donation_service.get_donation_by_id(db, donation_id)
    if not donation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Donation with ID {donation_id} not found.",
        )
    return _to_response(donation)


@router.get("/{donation_id}/receipt", response_model=DonationReceipt)
def get_donation_receipt(
    donation_id: str,
    db: Session = Depends(get_db),
):
    """Generate and view an official Section 80G tax receipt for a donation."""
    return donation_service.get_donation_receipt(db, donation_id)


@router.delete("/{donation_id}", status_code=status.HTTP_200_OK)
def delete_donation(
    donation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Soft delete donation record and roll back project/NGO totals."""
    success = donation_service.delete_donation(db, donation_id)
    return {"success": success, "message": f"Donation {donation_id} soft deleted successfully"}
