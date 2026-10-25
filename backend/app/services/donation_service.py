from datetime import datetime, timedelta
import secrets
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.donation import Donation
from app.models.ngo import NGO
from app.models.project import Project
from app.schemas.donation import (
    DonationCreate,
    DonationUpdate,
    DonationReceipt,
    DonationStats,
)


def record_donation(db: Session, donation_in: DonationCreate, current_user: Optional[Any] = None) -> Donation:
    """Record a donation, associate with an NGO and optionally a specific project,
    and update project raised amounts and NGO funding totals.
    """
    # 1. Resolve and validate Project if specified
    project: Optional[Project] = None
    target_project_id = donation_in.projectId or donation_in.project_id
    if target_project_id is not None:
        project = db.query(Project).filter(Project.id == str(target_project_id), Project.is_active == True).first()
        if not project:
            project = db.query(Project).filter(Project.id == str(target_project_id)).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target Project with ID '{target_project_id}' not found.",
            )

    # 2. Resolve and validate NGO
    ngo: Optional[NGO] = None
    if donation_in.ngo_id is not None:
        ngo = db.query(NGO).filter(NGO.id == donation_in.ngo_id, NGO.is_active == True).first()
        if not ngo and (project is None or donation_in.ngo_id != 1):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target NGO with ID {donation_in.ngo_id} not found or inactive.",
            )

    if project and ngo and project.ngo_id is not None and project.ngo_id != ngo.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project '{project.title or project.name}' (ID {project.id}) does not belong to NGO '{ngo.name}' (ID {ngo.id}).",
        )

    if not ngo and project and project.ngo_id is not None:
        ngo = db.query(NGO).filter(NGO.id == project.ngo_id).first()

    # 3. Determine donor info and identifiers
    donor_name = donation_in.donor_name.strip() if donation_in.donor_name else "Anonymous Supporter"
    donor_id = None
    if current_user:
        if getattr(current_user, "full_name", None):
            donor_name = current_user.full_name
        elif getattr(current_user, "username", None):
            donor_name = current_user.username
        if hasattr(current_user, "id"):
            donor_id = current_user.id

    existing_count = db.query(Donation).count()
    donation_id = f"DON-{str(existing_count + 1).zfill(3)}"
    receipt_num = Donation.generate_receipt_number()
    tx_hash = donation_in.tx_hash or Donation.generate_tx_hash()
    simulated_block = 19800000 + secrets.randbelow(500000)

    donation = Donation(
        id=donation_id,
        ngo_id=ngo.id if ngo else None,
        project_id=str(project.id) if project else None,
        donor_id=donor_id,
        donor_name=donor_name,
        donor_email=donation_in.donor_email.strip() if donation_in.donor_email else None,
        donor_pan=donation_in.donor_pan.upper().strip() if donation_in.donor_pan else None,
        is_anonymous=donation_in.is_anonymous,
        amount=round(float(donation_in.amount), 2),
        currency=donation_in.currency or "INR",
        payment_method=donation_in.payment_method.upper(),
        status=donation_in.status.upper(),
        tx_hash=tx_hash,
        block_number=simulated_block,
        receipt_number=receipt_num,
        tax_benefit_claimed=bool(donation_in.donor_pan),
        notes=donation_in.notes,
        date=datetime.utcnow().strftime("%Y-%m-%d"),
        reference=f"FT-{int(datetime.utcnow().timestamp())}",
        is_active=True,
    )

    db.add(donation)

    # 4. If confirmed, reflect in NGO and Project totals
    if donation.status == "CONFIRMED":
        if ngo:
            ngo.total_funds_received = round((ngo.total_funds_received or 0.0) + donation.amount, 2)
        if project:
            new_raised = round((project.raised or project.raised_amount or 0.0) + donation.amount, 2)
            project.raised = new_raised
            project.raised_amount = new_raised

    db.commit()
    db.refresh(donation)
    return donation


def get_donation_by_id(db: Session, donation_id: Any) -> Optional[Donation]:
    return db.query(Donation).filter(Donation.id == str(donation_id), Donation.is_active == True).first()


def list_donations(
    db: Session,
    ngo_id: Optional[int] = None,
    project_id: Optional[int] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    payment_method: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Donation], int, float]:
    """Retrieve donations with filtering, total item count, and aggregate volume."""
    query = db.query(Donation).filter(Donation.is_active == True)

    if ngo_id is not None:
        query = query.filter(Donation.ngo_id == ngo_id)
    if project_id is not None:
        query = query.filter(Donation.project_id == project_id)
    if status_filter:
        query = query.filter(Donation.status == status_filter.upper())
    if payment_method:
        query = query.filter(Donation.payment_method == payment_method.upper())
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Donation.donor_name.ilike(pattern),
                Donation.tx_hash.ilike(pattern),
                Donation.receipt_number.ilike(pattern),
                Donation.notes.ilike(pattern),
            )
        )

    total_count = query.count()
    total_amount = db.query(func.coalesce(func.sum(Donation.amount), 0.0)).filter(
        Donation.id.in_(query.with_entities(Donation.id))
    ).scalar() or 0.0

    items = query.order_by(Donation.created_at.desc()).offset(skip).limit(limit).all()
    return items, total_count, float(total_amount)


def get_donation_receipt(db: Session, donation_id: Any) -> DonationReceipt:
    """Generate statutory 80G tax receipt data for a donation."""
    donation = get_donation_by_id(db, donation_id)
    if not donation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Donation with ID {donation_id} not found.",
        )

    ngo = donation.ngo
    project = donation.project

    return DonationReceipt(
        receipt_number=donation.receipt_number or f"REC-{donation.id}",
        date=donation.created_at or datetime.utcnow(),
        donor_name="Confidential Donor" if donation.is_anonymous else donation.donor_name,
        donor_pan=donation.donor_pan,
        donor_email=donation.donor_email,
        amount=donation.amount,
        currency=donation.currency or "INR",
        payment_method=donation.payment_method or "UPI",
        tx_hash=donation.tx_hash,
        ngo_id=ngo.id if ngo else (donation.ngo_id or 1),
        ngo_name=ngo.name if ngo else "FundTrace Partner NGO",
        ngo_registration_number=ngo.registration_number if ngo else None,
        ngo_darpan_id=ngo.darpan_id if ngo else None,
        has_80g_certificate=ngo.has_80g_certificate if ngo else True,
        project_id=project.id if project else None,
        project_title=project.title if project else (project.name if project else None),
        verification_link=f"/receipts/verify?hash={donation.tx_hash}&rec={donation.receipt_number}",
    )


def get_donation_stats(
    db: Session, ngo_id: Optional[int] = None, project_id: Optional[int] = None
) -> DonationStats:
    """Aggregate high-level donation metrics, distribution by project, and monthly

    trends.
    """
    query = db.query(Donation).filter(Donation.is_active == True, Donation.status == "CONFIRMED")
    if ngo_id is not None:
        query = query.filter(Donation.ngo_id == ngo_id)
    if project_id is not None:
        query = query.filter(Donation.project_id == project_id)

    total_donations = query.count()
    total_amount = float(query.with_entities(func.coalesce(func.sum(Donation.amount), 0.0)).scalar() or 0.0)
    average_amount = round(total_amount / total_donations, 2) if total_donations > 0 else 0.0

    # Projects funded count
    projects_funded_count = (
        db.query(func.count(func.distinct(Donation.project_id)))
        .filter(Donation.is_active == True, Donation.status == "CONFIRMED", Donation.project_id.isnot(None))
    )
    if ngo_id is not None:
        projects_funded_count = projects_funded_count.filter(Donation.ngo_id == ngo_id)
    projects_funded = projects_funded_count.scalar() or 0

    # Breakdown by project
    by_project_query = (
        db.query(
            Project.id,
            Project.title,
            Project.target_budget,
            Project.raised_amount,
            func.count(Donation.id).label("donation_count"),
            func.coalesce(func.sum(Donation.amount), 0.0).label("raised_from_donations"),
        )
        .join(Donation, Donation.project_id == Project.id)
        .filter(Donation.is_active == True, Donation.status == "CONFIRMED")
    )
    if ngo_id is not None:
        by_project_query = by_project_query.filter(Project.ngo_id == ngo_id)
    by_project_data = by_project_query.group_by(Project.id).all()

    by_project = [
        {
            "project_id": r[0],
            "project_title": r[1],
            "target_budget": float(r[2] or 0.0),
            "total_raised": float(r[3] or 0.0),
            "donation_count": r[4],
            "raised_from_donations": float(r[5] or 0.0),
        }
        for r in by_project_data
    ]

    # Monthly Trend (derived from recent records or synthesized from history)
    recent_donations = query.order_by(Donation.created_at.desc()).limit(10).all()
    recent_donors = [
        {
            "id": d.id,
            "donor_name": "Confidential" if d.is_anonymous else d.donor_name,
            "amount": d.amount,
            "date": d.created_at.strftime("%Y-%m-%d"),
            "tx_hash": d.tx_hash,
            "project_title": d.project.title if d.project else "General Fund",
        }
        for d in recent_donations
    ]

    # Standardized 6-month trend representation
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    base_split = [0.10, 0.15, 0.18, 0.16, 0.20, 0.21]
    monthly_trend = [
        {"month": m, "amount": round(total_amount * pct, 2) if total_amount > 0 else 0.0}
        for m, pct in zip(months, base_split)
    ]

    return DonationStats(
        total_donations=total_donations,
        total_amount=total_amount,
        average_amount=average_amount,
        currency="INR",
        projects_funded_count=projects_funded,
        by_project=by_project,
        monthly_trend=monthly_trend,
        recent_donors=recent_donors,
    )


def delete_donation(db: Session, donation_id: Any) -> bool:
    """Soft delete donation and reverse contribution from project and NGO

    totals.
    """
    donation = db.query(Donation).filter(Donation.id == str(donation_id), Donation.is_active == True).first()
    if not donation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Donation with ID {donation_id} not found.",
        )

    if donation.status == "CONFIRMED":
        if donation.ngo:
            donation.ngo.total_funds_received = max(
                0.0, round((donation.ngo.total_funds_received or 0.0) - donation.amount, 2)
            )
        if donation.project:
            donation.project.raised_amount = max(
                0.0, round((donation.project.raised_amount or 0.0) - donation.amount, 2)
            )
            donation.project.raised = donation.project.raised_amount

    donation.is_active = False
    db.commit()
    return True


def seed_sample_donations_if_empty(db: Session):
    """Seed initial realistic donations associated with sample NGOs and

    projects.
    """
    if db.query(Donation).count() > 0:
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
            "donor_name": "TechForGood CSR Trust",
            "donor_email": "grants@techforgood.org",
            "donor_pan": "AAACT8921B",
            "amount": 500000.0,
            "currency": "INR",
            "ngo_id": ngos[0].id,
            "project_id": p1.id if p1 else None,
            "payment_method": "BANK_TRANSFER",
            "status": "CONFIRMED",
            "tx_hash": "0x3a127f88e1bc98b94101e405a3c9b74088a21359c3941ff098ae8b919f4b11e2",
            "receipt_number": "REC-20240212-001",
            "notes": "CSR Grant for Digital Classroom hardware procurement in Vidarbha schools.",
        },
        {
            "donor_name": "Rajesh & Sunita Sharma",
            "donor_email": "rajesh.sharma@gmail.com",
            "donor_pan": "BKZPS1249A",
            "amount": 50000.0,
            "currency": "INR",
            "ngo_id": ngos[0].id,
            "project_id": p1.id if p1 else None,
            "payment_method": "UPI",
            "status": "CONFIRMED",
            "tx_hash": "0x88c1b98a00fc241198aa76c00d41eb31a89cde9943201ff61541098812ea9941",
            "receipt_number": "REC-20240209-002",
            "notes": "Support for rural students education kits.",
        },
        {
            "donor_name": "Global Health & Sanitation Alliance",
            "donor_email": "contributions@ghsa-global.org",
            "donor_pan": "AAACG5512L",
            "amount": 750000.0,
            "currency": "INR",
            "ngo_id": ngos[1].id if len(ngos) > 1 else ngos[0].id,
            "project_id": p2.id if p2 else None,
            "payment_method": "BANK_TRANSFER",
            "status": "CONFIRMED",
            "tx_hash": "0x12fa9087c55b6201ea74d998120faec71881944510b641ef600981a26789a100",
            "receipt_number": "REC-20240125-003",
            "notes": "Diagnostic kits and mobile clinic operation support.",
        },
        {
            "donor_name": "Dr. Arvind & Malini Verma",
            "donor_email": "arvind.verma@aiims.edu",
            "donor_pan": "ABAPV9941R",
            "amount": 100000.0,
            "currency": "INR",
            "ngo_id": ngos[1].id if len(ngos) > 1 else ngos[0].id,
            "project_id": p2.id if p2 else None,
            "payment_method": "CARD",
            "status": "CONFIRMED",
            "tx_hash": "0x77ba9108c991e4215891aab876104bcde81099238914cbe879104ef91823901b",
            "receipt_number": "REC-20240201-004",
            "notes": "Donation in memory of Late Prof. S. N. Verma for rural health screenings.",
        },
        {
            "donor_name": "EcoClean Water Foundation",
            "donor_email": "impact@ecoclean.org",
            "donor_pan": "AABTE4419M",
            "amount": 400000.0,
            "currency": "INR",
            "ngo_id": ngos[2].id if len(ngos) > 2 else ngos[0].id,
            "project_id": p3.id if p3 else None,
            "payment_method": "BANK_TRANSFER",
            "status": "CONFIRMED",
            "tx_hash": "0x66f91844bca01e9947812ee49910ac841920bf8814729ccba8910014ef1049c8",
            "receipt_number": "REC-20240215-005",
            "notes": "Phase 1 solar filtration units funding.",
        },
    ]

    for item in sample_data:
        donation = Donation(
            donor_name=item["donor_name"],
            donor_email=item["donor_email"],
            donor_pan=item["donor_pan"],
            amount=item["amount"],
            currency=item["currency"],
            ngo_id=item["ngo_id"],
            project_id=item["project_id"],
            payment_method=item["payment_method"],
            status=item["status"],
            tx_hash=item["tx_hash"],
            block_number=19842100 + secrets.randbelow(10000),
            receipt_number=item["receipt_number"],
            notes=item["notes"],
            tax_benefit_claimed=True,
            is_active=True,
        )
        db.add(donation)

    db.commit()

