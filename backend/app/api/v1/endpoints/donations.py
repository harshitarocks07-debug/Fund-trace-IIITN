from datetime import datetime
from typing import List
import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.donation import Donation
from app.schemas.donation import DonationCreate, DonationOut
from app.core.permissions import get_current_user, require_donor

router = APIRouter()

@router.get("", response_model=List[DonationOut])
def list_donations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List donations. Donors only see their own donations; NGO Admin and Auditor see all donations."""
    if current_user.role == UserRole.DONOR.value:
        donations = db.query(Donation).filter(
            (Donation.donor_id == current_user.id) | (Donation.donor_name == current_user.full_name)
        ).all()
    else:
        donations = db.query(Donation).all()
    
    return [
        DonationOut(
            id=d.id,
            projectId=d.project_id,
            donor=d.donor_name,
            amount=d.amount,
            date=d.date,
            reference=d.reference,
        )
        for d in donations
    ]

@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def record_donation(
    donation_in: DonationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_donor),
):
    """Record a contribution. Strictly enforced: ONLY Donors can record contributions."""
    project = db.query(Project).filter(Project.id == donation_in.projectId).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{donation_in.projectId}' not found.",
        )
    
    existing_count = db.query(Donation).count()
    donation_id = f"DON-{str(existing_count + 1).zfill(3)}"
    today_str = datetime.now().strftime("%Y-%m-%d")
    ref = f"FT-{int(time.time())}"
    
    donation = Donation(
        id=donation_id,
        project_id=project.id,
        donor_id=current_user.id,
        donor_name=current_user.full_name,
        amount=donation_in.amount,
        date=today_str,
        reference=ref,
    )
    project.raised += donation_in.amount
    
    db.add(donation)
    db.commit()
    db.refresh(donation)
    
    return DonationOut(
        id=donation.id,
        projectId=donation.project_id,
        donor=donation.donor_name,
        amount=donation.amount,
        date=donation.date,
        reference=donation.reference,
    )

