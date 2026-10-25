from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import get_current_user
from app.models.user import User

from app.models.donation import Donation
from app.schemas.donation import (
    DonationCreate,
    DonationResponse,
    DonationListResponse,
    DonationReceipt,
    DonationStats,
)
from app.services import donation_service

router = APIRouter()


def _to_response(donation: Donation) -> DonationResponse:
    return DonationResponse(
        id=donation.id,
        donor_name="Confidential Donor" if donation.is_anonymous else donation.donor_name,
        donor_email=donation.donor_email,
        donor_pan=donation.donor_pan,
        amount=donation.amount,
        currency=donation.currency,
        ngo_id=donation.ngo_id,
        project_id=donation.project_id,
        payment_method=donation.payment_method,
        is_anonymous=donation.is_anonymous,
        notes=donation.notes,
        status=donation.status,
        tx_hash=donation.tx_hash,
        block_number=donation.block_number,
        receipt_number=donation.receipt_number,
        tax_benefit_claimed=donation.tax_benefit_claimed,
        is_active=donation.is_active,
        created_at=donation.created_at,
        updated_at=donation.updated_at,
        ngo_name=donation.ngo.name if donation.ngo else None,
        project_title=donation.project.title if donation.project else None,
    )


@router.post("/", response_model=DonationResponse, status_code=status.HTTP_201_CREATED)
def record_donation(
    donation_in: DonationCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Record a donor contribution and optionally associate it with a specific

    project initiative.
    """
    donation = donation_service.record_donation(db, donation_in)
    return _to_response(donation)


@router.get("/", response_model=DonationListResponse)
def list_donations(
    ngo_id: Optional[int] = None,
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List donations with filtering by NGO, associated project, and

    blockchain verification.
    """
    items, total, total_amount = donation_service.list_donations(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=project_id if isinstance(project_id, int) else None,
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
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retrieve high-level donation stats, volume by project, and monthly

    trends.
    """
    return donation_service.get_donation_stats(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=project_id if isinstance(project_id, int) else None,
    )



@router.get("/{donation_id}", response_model=DonationResponse)
def get_donation(
    donation_id: int,
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
    donation_id: int,
    db: Session = Depends(get_db),
):
    """Generate and view an official Section 80G tax receipt for a donation."""
    return donation_service.get_donation_receipt(db, donation_id)


@router.delete("/{donation_id}", status_code=status.HTTP_200_OK)
def delete_donation(
    donation_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Soft delete donation record and roll back project/NGO totals."""
    success = donation_service.delete_donation(db, donation_id)
    return {"success": success, "message": f"Donation {donation_id} soft deleted successfully"}
