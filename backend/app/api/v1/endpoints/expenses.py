from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseStatusUpdate,
    ExpenseResponse,
    ExpenseListResponse,
    ExpenseStats,
)
from app.services import expense_service

router = APIRouter()


def _to_response(expense: Expense) -> ExpenseResponse:
    return ExpenseResponse(
        id=expense.id,
        ngo_id=expense.ngo_id,
        project_id=expense.project_id,
        title=expense.title,
        description=expense.description,
        category=expense.category,
        amount=expense.amount,
        currency=expense.currency,
        payment_mode=expense.payment_mode,
        vendor_name=expense.vendor_name,
        invoice_number=expense.invoice_number,
        invoice_date=expense.invoice_date,
        receipt_hash=expense.receipt_hash,
        receipt_url=expense.receipt_url,
        status=expense.status,
        is_verified=expense.is_verified,
        verified_at=expense.verified_at,
        reviewed_by=expense.reviewed_by,
        review_notes=expense.review_notes,
        tx_hash=expense.tx_hash,
        is_active=expense.is_active,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
        ngo_name=expense.ngo.name if expense.ngo else None,
        project_title=expense.project.title if expense.project else None,
    )


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def submit_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Submit a new expenditure with invoice metadata, category, and optional

    project association.
    """
    reviewer = current_user.full_name if isinstance(current_user, User) and current_user.full_name else None
    expense = expense_service.submit_expense(db=db, expense_in=expense_in, reviewer_name=reviewer)
    return _to_response(expense)


@router.get("/", response_model=ExpenseListResponse)
def list_expenses(
    ngo_id: Optional[int] = None,
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List expenditures with filtering by NGO, associated project, status, and

    category.
    """
    items, total, total_amount, approved_amount, pending_amount = expense_service.list_expenses(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=project_id if isinstance(project_id, int) else None,
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
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Aggregate expenditure statistics, category distributions, and project

    utilization breakdowns.
    """
    return expense_service.get_expense_stats(
        db=db,
        ngo_id=ngo_id if isinstance(ngo_id, int) else None,
        project_id=project_id if isinstance(project_id, int) else None,
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
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
    expense_id: int,
    expense_in: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Update details of an existing expenditure."""
    expense = expense_service.update_expense(db, expense_id, expense_in)
    return _to_response(expense)


@router.patch("/{expense_id}/status", response_model=ExpenseResponse)
def update_expense_status(
    expense_id: int,
    status_update: ExpenseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Audit or update the status of an expenditure (PENDING -> APPROVED /

    REJECTED / FLAGGED).

    Automatically synchronizes Project utilized_amount and NGO
    total_funds_utilized.
    """
    reviewer = current_user.full_name if isinstance(current_user, User) and current_user.full_name else "Auditor"
    expense = expense_service.update_expense_status(db, expense_id, status_update, reviewer=reviewer)
    return _to_response(expense)


@router.delete("/{expense_id}", status_code=status.HTTP_200_OK)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Soft delete an expenditure record and reverse balances if previously

    approved.
    """
    success = expense_service.delete_expense(db, expense_id)
    return {"success": success, "message": f"Expense {expense_id} deleted successfully"}

