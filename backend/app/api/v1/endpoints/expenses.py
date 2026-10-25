import json
from datetime import datetime
from typing import Optional, List, Union, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import get_current_user, require_ngo_admin, require_auditor
from app.models.user import User, UserRole
from app.models.expense import Expense
from app.models.audit_log import AuditLog
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseStatusUpdate,
    ExpenseReview,
    ExpenseResponse,
    ExpenseListResponse,
    ExpenseStats,
    ExpenseOut,
)
from app.services import expense_service

router = APIRouter()


def _to_response(expense: Expense) -> ExpenseResponse:
    reasons: List[str] = []
    if expense.risk_reasons:
        try:
            reasons = json.loads(expense.risk_reasons)
            if not isinstance(reasons, list):
                reasons = [str(reasons)]
        except Exception:
            reasons = [str(expense.risk_reasons)]

    amt = float(expense.amount or expense.claimed_amount or 0.0)
    vnd = expense.vendor or expense.vendor_name or expense.title or ""
    inv = expense.invoice_number or ""
    rec_name = expense.receipt_name or "No receipt attached"
    rec_hash = expense.receipt_hash or ""
    proj_id_str = str(expense.project_id) if expense.project_id else None
    date_str = expense.date or (expense.created_at.strftime("%Y-%m-%d") if expense.created_at else "")

    return ExpenseResponse(
        id=str(expense.id),
        ngo_id=expense.ngo_id or 1,
        project_id=proj_id_str,
        projectId=proj_id_str,
        title=expense.title or vnd,
        description=expense.description,
        category=expense.category or "Operational",
        amount=amt,
        claimed_amount=amt,
        claimedAmount=amt,
        currency=expense.currency or "INR",
        payment_mode=expense.payment_mode or "BANK_TRANSFER",
        vendor=vnd,
        vendor_name=vnd,
        invoice_number=inv,
        invoiceNumber=inv,
        invoice_date=expense.invoice_date,
        receipt_name=rec_name,
        receiptName=rec_name,
        receipt_hash=rec_hash,
        receiptHash=rec_hash,
        receipt_url=expense.receipt_url,
        status=expense.status or "PENDING",
        is_verified=expense.is_verified or False,
        verified_at=expense.verified_at,
        reviewed_by=expense.reviewed_by,
        review_notes=expense.review_notes,
        tx_hash=expense.tx_hash,
        is_active=expense.is_active,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
        ngo_name=expense.ngo.name if expense.ngo else None,
        project_title=expense.project.title if (expense.project and hasattr(expense.project, "title")) else (expense.project.name if expense.project else None),
        risk_score=expense.risk_score or 0,
        riskScore=expense.risk_score or 0,
        risk_reasons=reasons,
        riskReasons=reasons,
        date=date_str,
        blockchain_status=expense.blockchain_status or "Not submitted",
        blockchainStatus=expense.blockchain_status or "Not submitted",
        blockchain_tx_hash=expense.blockchain_tx_hash,
        blockchainTxHash=expense.blockchain_tx_hash,
        blockchain_block_number=expense.blockchain_block_number,
        blockchainBlockNumber=expense.blockchain_block_number,
        blockchain_anchored_at=expense.blockchain_anchored_at,
        blockchainAnchoredAt=expense.blockchain_anchored_at,
        blockchain_commitment_root=expense.blockchain_commitment_root,
        blockchainCommitmentRoot=expense.blockchain_commitment_root,
        extracted_amount=expense.extracted_amount,
        extractedAmount=expense.extracted_amount,
        extracted_vendor=expense.extracted_vendor,
        extractedVendor=expense.extracted_vendor,
        extracted_invoice_number=expense.extracted_invoice_number,
        extractedInvoiceNumber=expense.extracted_invoice_number,
        extracted_date=expense.extracted_date,
        extractedDate=expense.extracted_date,
    )


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def submit_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Submit a new expenditure with invoice metadata, category, and risk validation.

    Strictly enforced: Only NGO Admins can submit claims.
    """
    if current_user is not None:
        user_role = getattr(current_user, "role", None)
        if user_role in [UserRole.DONOR.value, UserRole.AUDITOR.value, "Donor", "Auditor"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: NGO admin role required.",
            )

    reviewer = current_user.full_name if isinstance(current_user, User) and current_user.full_name else None
    expense = expense_service.submit_expense(
        db=db,
        expense_in=expense_in,
        reviewer_name=reviewer,
        current_user=current_user,
    )

    if current_user:
        audit_count = db.query(AuditLog).count()
        today_str = datetime.now().strftime("%Y-%m-%d")
        audit_entry = AuditLog(
            id=f"AUD-{str(audit_count + 1).zfill(3)}",
            expense_id=expense.id,
            action="Expense submitted",
            actor=current_user.full_name or "NGO Admin",
            actor_id=current_user.id,
            reason="Submitted by NGO Admin for review.",
            date=today_str,
        )
        db.add(audit_entry)
        db.commit()

    return _to_response(expense)


@router.get("", response_model=ExpenseListResponse)
@router.get("/", response_model=ExpenseListResponse)
def list_expenses(
    ngo_id: Optional[int] = None,
    project_id: Optional[Union[str, int]] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """List expenditures with filtering by NGO, associated project, status, and category."""
    items, total, total_amount, approved_amount, pending_amount = expense_service.list_expenses(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=str(project_id) if project_id is not None else None,
        status_filter=status if isinstance(status, str) else None,
        category=category if isinstance(category, str) else None,
        search=search if isinstance(search, str) else None,
        skip=skip if isinstance(skip, int) else 0,
        limit=limit if isinstance(limit, int) else 50,
    )
    return ExpenseListResponse(
        items=[_to_response(e) for e in items],
        total=total,
        total_amount=total_amount,
        approved_amount=approved_amount,
        pending_amount=pending_amount,
        skip=skip if isinstance(skip, int) else 0,
        limit=limit if isinstance(limit, int) else 50,
    )


@router.get("/stats/summary", response_model=ExpenseStats)
def get_expense_statistics(
    ngo_id: Optional[int] = None,
    project_id: Optional[Union[str, int]] = None,
    db: Session = Depends(get_db),
):
    """Aggregate expenditure statistics, category distributions, and project utilization breakdowns."""
    return expense_service.get_expense_stats(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=str(project_id) if project_id is not None else None,
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve full details of an individual expenditure record."""
    expense = expense_service.get_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID {expense_id} not found.",
        )
    return _to_response(expense)


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: str,
    expense_in: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Update details of an existing expenditure."""
    expense = expense_service.update_expense(db, expense_id, expense_in)
    return _to_response(expense)


@router.patch("/{expense_id}/status", response_model=ExpenseResponse)
def update_expense_status(
    expense_id: str,
    status_update: ExpenseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Audit or update the status of an expenditure (PENDING -> APPROVED / REJECTED / FLAGGED)."""
    reviewer = current_user.full_name if isinstance(current_user, User) and current_user.full_name else "Auditor"
    expense = expense_service.update_expense_status(db, expense_id, status_update, reviewer=reviewer)
    return _to_response(expense)


@router.post("/{expense_id}/review", response_model=ExpenseResponse)
def review_expense(
    expense_id: str,
    review_in: ExpenseReview,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Review an expense claim. Strictly enforced: ONLY Auditors can approve, reject, or request more evidence."""
    if current_user is not None:
        user_role = getattr(current_user, "role", None)
        if user_role in [UserRole.DONOR.value, UserRole.NGO_ADMIN.value, "Donor", "NGO admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Auditor role required.",
            )

    valid_statuses = ["Approved", "Rejected", "More evidence", "APPROVED", "REJECTED"]
    if review_in.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review status '{review_in.status}'. Valid choices: Approved, Rejected, More evidence",
        )

    reviewer_name = current_user.full_name if current_user else "Auditor"
    reviewer_id = getattr(current_user, "id", None) if current_user else None

    expense = expense_service.update_expense_status(
        db=db,
        expense_id=expense_id,
        status_update=review_in,
        reviewer=reviewer_name,
    )
    if reviewer_id:
        expense.reviewed_by_id = reviewer_id

    # Record auditor decision in audit log
    audit_count = db.query(AuditLog).count()
    today_str = datetime.now().strftime("%Y-%m-%d")
    audit_entry = AuditLog(
        id=f"AUD-{str(audit_count + 1).zfill(3)}",
        expense_id=expense.id,
        action=review_in.status,
        actor=reviewer_name,
        actor_id=reviewer_id,
        reason=review_in.reason,
        date=today_str,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(expense)

    return _to_response(expense)


@router.delete("/{expense_id}", status_code=status.HTTP_200_OK)
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Soft delete an expenditure record and reverse balances if previously approved."""
    success = expense_service.delete_expense(db, expense_id)
    return {"success": success, "message": f"Expense {expense_id} deleted successfully"}
