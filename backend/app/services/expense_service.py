from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.expense import Expense
from app.models.ngo import NGO
from app.models.project import Project
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseStatusUpdate,
    ExpenseStats,
)


def submit_expense(
    db: Session,
    expense_in: ExpenseCreate,
    reviewer_name: Optional[str] = None,
) -> Expense:
    """Submit a new expenditure record, optionally associating it with an active

    project initiative.
    """
    # 1. Validate NGO
    ngo = db.query(NGO).filter(NGO.id == expense_in.ngo_id, NGO.is_active == True).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target NGO with ID {expense_in.ngo_id} not found or inactive.",
        )

    # 2. Validate Project if supplied
    project: Optional[Project] = None
    if expense_in.project_id is not None:
        project = db.query(Project).filter(Project.id == expense_in.project_id, Project.is_active == True).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target Project with ID {expense_in.project_id} not found or inactive.",
            )
        if project.ngo_id != ngo.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project '{project.title}' (ID {project.id}) does not belong to NGO '{ngo.name}' (ID {ngo.id}).",
            )

    receipt_hash = expense_in.receipt_hash or Expense.generate_receipt_hash()
    clean_status = expense_in.status.upper().strip()

    is_approved = clean_status in ("APPROVED", "REIMBURSED")
    tx_hash = Expense.generate_tx_hash() if is_approved else None

    expense = Expense(
        ngo_id=ngo.id,
        project_id=project.id if project else None,
        title=expense_in.title.strip(),
        description=expense_in.description.strip() if expense_in.description else None,
        category=expense_in.category,
        amount=round(float(expense_in.amount), 2),
        currency=expense_in.currency or "INR",
        payment_mode=expense_in.payment_mode.upper(),
        vendor_name=expense_in.vendor_name.strip() if expense_in.vendor_name else None,
        invoice_number=expense_in.invoice_number.strip() if expense_in.invoice_number else None,
        invoice_date=expense_in.invoice_date or datetime.utcnow(),
        receipt_hash=receipt_hash,
        receipt_url=expense_in.receipt_url,
        status=clean_status,
        is_verified=is_approved,
        verified_at=datetime.utcnow() if is_approved else None,
        reviewed_by=reviewer_name if is_approved else None,
        tx_hash=tx_hash,
        is_active=True,
    )

    db.add(expense)

    # If approved immediately, adjust utilization figures
    if is_approved:
        ngo.total_funds_utilized = round((ngo.total_funds_utilized or 0.0) + expense.amount, 2)
        if project:
            project.utilized_amount = round((project.utilized_amount or 0.0) + expense.amount, 2)

    db.commit()
    db.refresh(expense)
    return expense


def get_expense_by_id(db: Session, expense_id: int) -> Optional[Expense]:
    return db.query(Expense).filter(Expense.id == expense_id, Expense.is_active == True).first()


def list_expenses(
    db: Session,
    ngo_id: Optional[int] = None,
    project_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Expense], int, float, float, float]:
    """Retrieve expenditures matching filter parameters with aggregate volume

    breakdowns.
    """
    query = db.query(Expense).filter(Expense.is_active == True)

    if ngo_id is not None:
        query = query.filter(Expense.ngo_id == ngo_id)
    if project_id is not None:
        query = query.filter(Expense.project_id == project_id)
    if status_filter:
        query = query.filter(Expense.status == status_filter.upper())
    if category:
        query = query.filter(Expense.category.ilike(f"%{category.strip()}%"))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Expense.title.ilike(pattern),
                Expense.vendor_name.ilike(pattern),
                Expense.invoice_number.ilike(pattern),
                Expense.description.ilike(pattern),
                Expense.receipt_hash.ilike(pattern),
            )
        )

    total_count = query.count()

    # Aggregate volumes
    total_amount = float(query.with_entities(func.coalesce(func.sum(Expense.amount), 0.0)).scalar() or 0.0)

    approved_amount = float(
        query.filter(Expense.status.in_(["APPROVED", "REIMBURSED"]))
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
        or 0.0
    )

    pending_amount = float(
        query.filter(Expense.status == "PENDING")
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
        or 0.0
    )

    items = query.order_by(Expense.created_at.desc()).offset(skip).limit(limit).all()
    return items, total_count, total_amount, approved_amount, pending_amount


def update_expense(
    db: Session,
    expense_id: int,
    expense_in: ExpenseUpdate,
) -> Expense:
    """Update expense details with balance adjustment if amount changes while

    approved.
    """
    expense = get_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID {expense_id} not found.",
        )

    old_amount = expense.amount
    was_approved = expense.status in ("APPROVED", "REIMBURSED")

    update_dict = expense_in.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if field == "project_id" and val is not None:
            # Validate project
            prj = db.query(Project).filter(Project.id == val, Project.is_active == True).first()
            if not prj or prj.ngo_id != expense.ngo_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Project ID {val} invalid or does not belong to NGO {expense.ngo_id}.",
                )
        setattr(expense, field, val)

    # If amount modified on an approved expense, adjust project and NGO balances
    if was_approved and "amount" in update_dict:
        diff = round(expense.amount - old_amount, 2)
        if expense.ngo:
            expense.ngo.total_funds_utilized = max(0.0, round((expense.ngo.total_funds_utilized or 0.0) + diff, 2))
        if expense.project:
            expense.project.utilized_amount = max(0.0, round((expense.project.utilized_amount or 0.0) + diff, 2))

    db.commit()
    db.refresh(expense)
    return expense


def update_expense_status(
    db: Session,
    expense_id: int,
    status_update: ExpenseStatusUpdate,
    reviewer: Optional[str] = None,
) -> Expense:
    """Manage lifecycle status of an expense (PENDING -> APPROVED / REJECTED /

    FLAGGED).

    Maintains automatic synchronization of NGO total_funds_utilized and Project
    utilized_amount.
    """
    expense = get_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID {expense_id} not found.",
        )

    old_status = expense.status.upper()
    new_status = status_update.status.upper()

    was_approved = old_status in ("APPROVED", "REIMBURSED")
    is_now_approved = new_status in ("APPROVED", "REIMBURSED")

    expense.status = new_status
    expense.review_notes = status_update.review_notes
    expense.reviewed_by = status_update.reviewed_by or reviewer or expense.reviewed_by

    if is_now_approved and not was_approved:
        # Transitioning into approved state: credit utilization
        expense.is_verified = True
        expense.verified_at = datetime.utcnow()
        if not expense.tx_hash:
            expense.tx_hash = Expense.generate_tx_hash()

        if expense.ngo:
            expense.ngo.total_funds_utilized = round(
                (expense.ngo.total_funds_utilized or 0.0) + expense.amount, 2
            )
        if expense.project:
            expense.project.utilized_amount = round(
                (expense.project.utilized_amount or 0.0) + expense.amount, 2
            )

    elif was_approved and not is_now_approved:
        # Transitioning away from approved state (rejected or flagged): reverse utilization
        expense.is_verified = False
        if expense.ngo:
            expense.ngo.total_funds_utilized = max(
                0.0, round((expense.ngo.total_funds_utilized or 0.0) - expense.amount, 2)
            )
        if expense.project:
            expense.project.utilized_amount = max(
                0.0, round((expense.project.utilized_amount or 0.0) - expense.amount, 2)
            )

    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, expense_id: int) -> bool:
    """Soft delete an expense and reverse balances if it was approved."""
    expense = get_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID {expense_id} not found.",
        )

    if expense.status in ("APPROVED", "REIMBURSED"):
        if expense.ngo:
            expense.ngo.total_funds_utilized = max(
                0.0, round((expense.ngo.total_funds_utilized or 0.0) - expense.amount, 2)
            )
        if expense.project:
            expense.project.utilized_amount = max(
                0.0, round((expense.project.utilized_amount or 0.0) - expense.amount, 2)
            )

    expense.is_active = False
    db.commit()
    return True


def get_expense_stats(
    db: Session,
    ngo_id: Optional[int] = None,
    project_id: Optional[int] = None,
) -> ExpenseStats:
    """Aggregate expenditure analytics, breakdowns by category and project."""
    query = db.query(Expense).filter(Expense.is_active == True)
    if ngo_id is not None:
        query = query.filter(Expense.ngo_id == ngo_id)
    if project_id is not None:
        query = query.filter(Expense.project_id == project_id)

    total_count = query.count()
    total_amount = float(query.with_entities(func.coalesce(func.sum(Expense.amount), 0.0)).scalar() or 0.0)
    approved_amount = float(
        query.filter(Expense.status.in_(["APPROVED", "REIMBURSED"]))
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
        or 0.0
    )
    pending_amount = float(
        query.filter(Expense.status == "PENDING")
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
        or 0.0
    )
    rejected_amount = float(
        query.filter(Expense.status == "REJECTED")
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
        or 0.0
    )

    # Category breakdown
    cat_data = (
        db.query(Expense.category, func.count(Expense.id), func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.is_active == True)
    )
    if ngo_id is not None:
        cat_data = cat_data.filter(Expense.ngo_id == ngo_id)
    if project_id is not None:
        cat_data = cat_data.filter(Expense.project_id == project_id)
    cat_rows = cat_data.group_by(Expense.category).all()

    by_category = [
        {"category": r[0], "count": r[1], "amount": float(r[2])}
        for r in cat_rows
    ]

    # Project breakdown
    prj_data = (
        db.query(Project.id, Project.title, func.count(Expense.id), func.coalesce(func.sum(Expense.amount), 0.0))
        .join(Expense, Expense.project_id == Project.id)
        .filter(Expense.is_active == True)
    )
    if ngo_id is not None:
        prj_data = prj_data.filter(Project.ngo_id == ngo_id)
    prj_rows = prj_data.group_by(Project.id).all()

    by_project = [
        {"project_id": r[0], "project_title": r[1], "count": r[2], "amount": float(r[3])}
        for r in prj_rows
    ]

    # Recent expenses
    recent = query.order_by(Expense.created_at.desc()).limit(8).all()
    recent_expenses = [
        {
            "id": e.id,
            "title": e.title,
            "category": e.category,
            "amount": e.amount,
            "status": e.status,
            "vendor_name": e.vendor_name,
            "project_title": e.project.title if e.project else "General Fund",
            "date": e.created_at.strftime("%Y-%m-%d"),
        }
        for e in recent
    ]

    return ExpenseStats(
        total_expenses_count=total_count,
        total_amount=total_amount,
        approved_amount=approved_amount,
        pending_amount=pending_amount,
        rejected_amount=rejected_amount,
        currency="INR",
        by_category=by_category,
        by_project=by_project,
        recent_expenses=recent_expenses,
    )


def seed_sample_expenses_if_empty(db: Session):
    """Seed initial realistic expenditure bills and invoices."""
    if db.query(Expense).count() > 0:
        return

    ngos = db.query(NGO).filter(NGO.is_active == True).all()
    if not ngos:
        return

    projects = db.query(Project).filter(Project.is_active == True).all()
    p1 = projects[0] if len(projects) > 0 else None
    p2 = projects[1] if len(projects) > 1 else None
    p3 = projects[2] if len(projects) > 2 else None

    sample_data = [
        {
            "ngo_id": ngos[0].id,
            "project_id": p1.id if p1 else None,
            "title": "Classroom Tablets & Solar Power Units",
            "description": "Procurement of 25 rugged Android learning tablets and 5 solar backup chargers for remote schools.",
            "category": "Hardware",
            "amount": 185000.0,
            "payment_mode": "BANK_TRANSFER",
            "vendor_name": "Vidarbha Digital Systems Pvt Ltd",
            "invoice_number": "VDS-2024-0412",
            "status": "APPROVED",
            "receipt_hash": "QmZ4tjB7F8329kLP890123abcde",
            "reviewed_by": "Compliance Auditor (S. Kulkarni)",
            "review_notes": "All hardware physically verified and tagged in school inventory asset ledger.",
        },
        {
            "ngo_id": ngos[0].id,
            "project_id": p1.id if p1 else None,
            "title": "Teacher Digital Literacy Workshops - Batch 1",
            "description": "5-day master trainer capacity building for 30 rural school educators.",
            "category": "Training",
            "amount": 95000.0,
            "payment_mode": "BANK_TRANSFER",
            "vendor_name": "EdTech Shiksha Foundation",
            "invoice_number": "EDT-2024-118",
            "status": "APPROVED",
            "receipt_hash": "QmY8kpM123456789abcdef0123",
            "reviewed_by": "Compliance Auditor (S. Kulkarni)",
            "review_notes": "Attendance sheets and post-workshop evaluation certificates attached.",
        },
        {
            "ngo_id": ngos[0].id,
            "project_id": p1.id if p1 else None,
            "title": "Hands-on Science & STEM Experiment Kits",
            "description": "50 modular science lab kits distributed across 5 zilla parishad schools.",
            "category": "Materials",
            "amount": 64000.0,
            "payment_mode": "UPI",
            "vendor_name": "Nagpur Scientific & Lab Suppliers",
            "invoice_number": "NSLS-9982",
            "status": "APPROVED",
            "receipt_hash": "QmA9plK45678901234abcdef01",
            "reviewed_by": "Senior Program Officer",
            "review_notes": "Delivery challans signed by school headmasters verified.",
        },
        {
            "ngo_id": ngos[1].id if len(ngos) > 1 else ngos[0].id,
            "project_id": p2.id if p2 else None,
            "title": "Mobile Clinic Diagnostic Testing Kits",
            "description": "Rapid malaria, blood sugar, and hemoglobin test strips and portable centrifuge.",
            "category": "Medical",
            "amount": 120000.0,
            "payment_mode": "BANK_TRANSFER",
            "vendor_name": "CareBio Diagnostics Ltd",
            "invoice_number": "CBD-2024-8841",
            "status": "APPROVED",
            "receipt_hash": "QmB11cd77889900aabbccddeeff",
            "reviewed_by": "Medical Audit Lead",
            "review_notes": "Batch expiration dates beyond 2027 confirmed; stored in cold chain.",
        },
        {
            "ngo_id": ngos[1].id if len(ngos) > 1 else ngos[0].id,
            "project_id": p2.id if p2 else None,
            "title": "Mobile Health Van Diesel & Vehicle Maintenance",
            "description": "Routine scheduled service, new radial tyres, and diesel fuel card recharge.",
            "category": "Logistics",
            "amount": 38000.0,
            "payment_mode": "CARD",
            "vendor_name": "Mahindra Authorized Service Center",
            "invoice_number": "MASC-7712",
            "status": "PENDING",
            "receipt_hash": "QmC22ee99001122aabbccddee00",
            "reviewed_by": None,
            "review_notes": "Pending odometer logbook verification.",
        },
    ]

    for item in sample_data:
        expense = Expense(
            ngo_id=item["ngo_id"],
            project_id=item["project_id"],
            title=item["title"],
            description=item["description"],
            category=item["category"],
            amount=item["amount"],
            payment_mode=item["payment_mode"],
            vendor_name=item["vendor_name"],
            invoice_number=item["invoice_number"],
            invoice_date=datetime.utcnow(),
            status=item["status"],
            receipt_hash=item["receipt_hash"],
            is_verified=(item["status"] == "APPROVED"),
            verified_at=datetime.utcnow() if item["status"] == "APPROVED" else None,
            reviewed_by=item["reviewed_by"],
            review_notes=item["review_notes"],
            tx_hash=Expense.generate_tx_hash() if item["status"] == "APPROVED" else None,
            is_active=True,
        )
        db.add(expense)

    db.commit()

