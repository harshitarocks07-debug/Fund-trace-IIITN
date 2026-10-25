from datetime import datetime
from typing import List, Optional
import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.donation import Donation
from app.schemas.donation import (
    DonationCreate,
    DonationOut,
    DonationCommitmentVerifyRequest,
    DonationCommitmentVerifyResponse,
    DonationPaymentVerifyRequest,
    DonationPaymentVerifyResponse,
)
from app.core.permissions import get_current_user, require_donor, require_ngo_admin_or_auditor
from app.services.donation_service import (
    generate_donation_salt,
    compute_donation_commitment,
    anchor_donation_commitment_on_chain,
    verify_donation_commitment_on_chain,
    verify_donation_preimage_credentials,
    verify_actual_payment_transaction,
)

router = APIRouter()

@router.get("", response_model=List[DonationOut])
def list_donations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List donations.
    - Donors only see their own donations, with personal credentials.
    - NGO Admins and Auditors see all donations, but donor PII can be inspected in secure database view.
    - Zero-PII commitment hashes and payment verification statuses are provided.
    """
    if current_user.role == UserRole.DONOR.value:
        donations = db.query(Donation).filter(
            (Donation.donor_id == current_user.id) | (Donation.donor_name == current_user.full_name)
        ).all()
    else:
        donations = db.query(Donation).all()
    
    # Auto-populate commitments for legacy rows if missing
    for d in donations:
        if not d.commitment_hash:
            d.blinding_salt = d.blinding_salt or generate_donation_salt()
            d.commitment_hash = compute_donation_commitment(
                d.id, d.project_id, d.amount, d.reference, d.blinding_salt
            )
            db.commit()

    return [
        DonationOut(
            id=d.id,
            projectId=d.project_id,
            donor=d.donor_name if (current_user.role != UserRole.DONOR.value or d.donor_id == current_user.id) else "Shielded Donor",
            amount=d.amount,
            date=d.date,
            reference=d.reference,
            paymentStatus=d.payment_status or "Pending",
            paymentMethod=d.payment_method or "Bank Transfer",
            paymentTxHash=d.payment_tx_hash,
            paymentVerifiedAt=d.payment_verified_at.isoformat() if d.payment_verified_at else None,
            blockchainStatus=d.blockchain_status or "Not submitted",
            commitmentHash=d.commitment_hash,
            blockchainTxHash=d.blockchain_tx_hash,
            blockchainBlockNumber=d.blockchain_block_number,
            blindingSalt=d.blinding_salt if (current_user.role != UserRole.DONOR.value or d.donor_id == current_user.id) else None,
        )
        for d in donations
    ]

@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def record_donation(
    donation_in: DonationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_donor),
):
    """
    Record a contribution with privacy-preserving zero-PII cryptographic commitment.
    1. Keeps donor names, emails, and phone numbers strictly off-chain in secure database.
    2. Generates a random blinding salt and computes Keccak-256 commitment.
    3. Anchors the commitment on the Ethereum-compatible blockchain.
    4. Updates project-level public financial aggregates without leaking donor identities.
    5. Leaves payment status as 'Pending' until verified separately from the commitment.
    """
    project = db.query(Project).filter(Project.id == donation_in.projectId).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{donation_in.projectId}' not found.",
        )
    
    existing_count = db.query(Donation).count()
    donation_id = f"DON-{str(existing_count + 1).zfill(3)}"
    today_str = datetime.now().strftime("%Y-%m-%d")
    ref = donation_in.paymentReference or f"FT-{int(time.time())}"
    
    # Generate cryptographic commitment
    salt = generate_donation_salt()
    commitment = compute_donation_commitment(
        donation_id=donation_id,
        project_id=project.id,
        amount=donation_in.amount,
        payment_reference=ref,
        blinding_salt=salt,
    )

    donation = Donation(
        id=donation_id,
        project_id=project.id,
        donor_id=current_user.id,
        donor_name=donation_in.donorName or current_user.full_name,
        donor_email=donation_in.donorEmail or current_user.email,
        donor_phone=donation_in.donorPhone,
        amount=donation_in.amount,
        date=today_str,
        reference=ref,
        blinding_salt=salt,
        commitment_hash=commitment,
        payment_status="Pending", # Payment verified separately
        payment_method=donation_in.paymentMethod or "Bank Transfer",
        blockchain_status="Not submitted",
    )
    
    project.raised += donation_in.amount
    db.add(donation)
    db.commit()
    db.refresh(donation)

    # Anchor commitment to smart contract
    try:
        anchor_donation_commitment_on_chain(db, donation)
    except Exception as e:
        # Graceful fallback handled inside service
        pass

    return DonationOut(
        id=donation.id,
        projectId=donation.project_id,
        donor=donation.donor_name,
        amount=donation.amount,
        date=donation.date,
        reference=donation.reference,
        paymentStatus=donation.payment_status,
        paymentMethod=donation.payment_method,
        paymentTxHash=donation.payment_tx_hash,
        paymentVerifiedAt=donation.payment_verified_at.isoformat() if donation.payment_verified_at else None,
        blockchainStatus=donation.blockchain_status,
        commitmentHash=donation.commitment_hash,
        blockchainTxHash=donation.blockchain_tx_hash,
        blockchainBlockNumber=donation.blockchain_block_number,
        blindingSalt=donation.blinding_salt,
    )

@router.post("/{donation_id}/anchor", response_model=DonationOut)
def anchor_donation_endpoint(
    donation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor_or_ngo),
):
    """Manually anchor or re-anchor a donation commitment on-chain."""
    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if not donation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Donation with ID '{donation_id}' not found.",
        )
    
    anchor_donation_commitment_on_chain(db, donation)

    return DonationOut(
        id=donation.id,
        projectId=donation.project_id,
        donor=donation.donor_name,
        amount=donation.amount,
        date=donation.date,
        reference=donation.reference,
        paymentStatus=donation.payment_status,
        paymentMethod=donation.payment_method,
        paymentTxHash=donation.payment_tx_hash,
        paymentVerifiedAt=donation.payment_verified_at.isoformat() if donation.payment_verified_at else None,
        blockchainStatus=donation.blockchain_status,
        commitmentHash=donation.commitment_hash,
        blockchainTxHash=donation.blockchain_tx_hash,
        blockchainBlockNumber=donation.blockchain_block_number,
        blindingSalt=donation.blinding_salt,
    )

@router.post("/verify-commitment", response_model=DonationCommitmentVerifyResponse)
def verify_commitment_endpoint(
    request: DonationCommitmentVerifyRequest,
    db: Session = Depends(get_db),
):
    """
    Verify a donation record commitment on-chain without exposing donor PII.
    Allows anyone holding the receipt credentials and blinding salt to prove
    that the donation is authentic and anchored on the blockchain.
    """
    return verify_donation_preimage_credentials(
        db=db,
        donation_id=request.donationId,
        project_id=request.projectId,
        amount=request.amount,
        payment_reference=request.paymentReference,
        blinding_salt=request.blindingSalt,
    )

@router.post("/{donation_id}/verify-payment", response_model=DonationPaymentVerifyResponse)
def verify_payment_endpoint(
    donation_id: str,
    request: DonationPaymentVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor_or_ngo),
):
    """
    Verify actual payment transaction settlement separately from the donation record commitment.
    Links the bank wire / payment gateway transaction hash to the donation.
    """
    try:
        return verify_actual_payment_transaction(
            db=db,
            donation_id=donation_id,
            payment_tx_hash=request.paymentTxHash,
            payment_method=request.paymentMethod or "Bank Settlement",
            auditor_or_admin=current_user,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve),
        )
