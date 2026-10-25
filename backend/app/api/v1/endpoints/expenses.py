import json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.project import Project
from app.models.expense import Expense
from app.models.audit_log import AuditLog
from app.schemas.expense import ExpenseCreate, ExpenseReview, ExpenseOut
from app.core.permissions import get_current_user, require_ngo_admin, require_auditor

router = APIRouter()

def _serialize_expense(e: Expense) -> ExpenseOut:
    reasons = []
    try:
        reasons = json.loads(e.risk_reasons)
    except Exception:
        reasons = [e.risk_reasons] if e.risk_reasons else []
    
    return ExpenseOut(
        id=e.id,
        projectId=e.project_id,
        vendor=e.vendor,
        category=e.category,
        invoiceNumber=e.invoice_number,
        claimedAmount=e.claimed_amount,
        receiptName=e.receipt_name,
        receiptHash=e.receipt_hash,
        extractedAmount=e.extracted_amount,
        extractedVendor=e.extracted_vendor,
        extractedInvoiceNumber=e.extracted_invoice_number,
        extractedDate=e.extracted_date,
        status=e.status,
        riskScore=e.risk_score,
        riskReasons=reasons,
        date=e.date,
        blockchainStatus=e.blockchain_status,
        blockchainTxHash=e.blockchain_tx_hash,
        blockchainBlockNumber=e.blockchain_block_number,
        blockchainAnchoredAt=e.blockchain_anchored_at,
        blockchainCommitmentRoot=e.blockchain_commitment_root,
    )

@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List expenses. Accessible to all authenticated users."""
    expenses = db.query(Expense).order_by(Expense.id.desc()).all()
    return [_serialize_expense(e) for e in expenses]

@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def submit_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin),
):
    """Submit an expense claim. Strictly enforced: ONLY NGO Admins can submit expense claims."""
    project = db.query(Project).filter(Project.id == expense_in.projectId).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{expense_in.projectId}' not found.",
        )
    
    reasons = []
    score = 0

    # Rule 1: Duplicate receipt hash check
    if expense_in.receiptHash:
        duplicate = db.query(Expense).filter(Expense.receipt_hash == expense_in.receiptHash).first()
        if duplicate:
            reasons.append("Exact receipt file has already been submitted")
            score += 45

    # Rule 2: Amount mismatch check
    if expense_in.extractedAmount is not None and expense_in.extractedAmount != expense_in.claimedAmount:
        diff = abs(expense_in.claimedAmount - expense_in.extractedAmount)
        reasons.append(f"Claimed amount differs from receipt amount by ₹{diff:,.2f}")
        score += 30

    # Rule 2b: Vendor name mismatch check
    if expense_in.extractedVendor:
        ev_clean = expense_in.extractedVendor.lower()
        v_clean = expense_in.vendor.lower()
        if ev_clean not in v_clean and v_clean not in ev_clean:
            reasons.append(f"Claimed vendor ('{expense_in.vendor}') differs from receipt vendor ('{expense_in.extractedVendor}')")
            score += 20

    # Rule 2c: Invoice number mismatch check
    if expense_in.extractedInvoiceNumber:
        ei_clean = expense_in.extractedInvoiceNumber.strip().lower()
        i_clean = expense_in.invoiceNumber.strip().lower()
        if ei_clean != i_clean and ei_clean not in i_clean and i_clean not in ei_clean:
            reasons.append(f"Claimed invoice number ('{expense_in.invoiceNumber}') differs from receipt invoice ('{expense_in.extractedInvoiceNumber}')")
            score += 15

    # Rule 3: Budget overflow check
    approved_for_proj = sum(
        e.claimed_amount
        for e in db.query(Expense).filter(
            Expense.project_id == project.id,
            Expense.status == "Approved"
        ).all()
    )
    if approved_for_proj + expense_in.claimedAmount > project.budget:
        reasons.append("Claim exceeds remaining project budget")
        score += 25

    # Rule 4: Receipt missing check
    if not expense_in.receiptHash:
        reasons.append("No receipt attached")
        score += 30

    if not reasons:
        reasons.append("No automatic warning triggered; human review is still required")

    score = min(100, score)
    existing_count = db.query(Expense).count()
    expense_id = f"EXP-{str(existing_count + 1).zfill(3)}"
    today_str = datetime.now().strftime("%Y-%m-%d")

    expense = Expense(
        id=expense_id,
        project_id=project.id,
        submitted_by_id=current_user.id,
        vendor=expense_in.vendor.strip(),
        category=expense_in.category.strip(),
        invoice_number=expense_in.invoiceNumber.strip(),
        claimed_amount=expense_in.claimedAmount,
        receipt_name=expense_in.receiptName,
        receipt_hash=expense_in.receiptHash,
        extracted_amount=expense_in.extractedAmount,
        extracted_vendor=expense_in.extractedVendor,
        extracted_invoice_number=expense_in.extractedInvoiceNumber,
        extracted_date=expense_in.extractedDate,
        status="Pending review",
        risk_score=score,
        risk_reasons=json.dumps(reasons),
        date=today_str,
        blockchain_status="Not submitted",
    )
    db.add(expense)

    # Record initial audit entry
    audit_count = db.query(AuditLog).count()
    audit_entry = AuditLog(
        id=f"AUD-{str(audit_count + 1).zfill(3)}",
        expense_id=expense.id,
        action="Expense submitted",
        actor=current_user.full_name,
        actor_id=current_user.id,
        reason="Submitted by NGO Admin for review.",
        date=today_str,
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(expense)
    return _serialize_expense(expense)

@router.post("/{expense_id}/review", response_model=ExpenseOut)
def review_expense(
    expense_id: str,
    review_in: ExpenseReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor),
):
    """Review an expense claim. Strictly enforced: ONLY Auditors can approve, reject, or request more evidence."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID '{expense_id}' not found.",
        )
    
    valid_statuses = ["Approved", "Rejected", "More evidence"]
    if review_in.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review status '{review_in.status}'. Valid choices: {', '.join(valid_statuses)}",
        )
    
    expense.status = review_in.status
    expense.reviewed_by_id = current_user.id

    # Record auditor decision in audit log
    audit_count = db.query(AuditLog).count()
    today_str = datetime.now().strftime("%Y-%m-%d")
    audit_entry = AuditLog(
        id=f"AUD-{str(audit_count + 1).zfill(3)}",
        expense_id=expense.id,
        action=review_in.status,
        actor=current_user.full_name,
        actor_id=current_user.id,
        reason=review_in.reason,
        date=today_str,
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(expense)
    return _serialize_expense(expense)

