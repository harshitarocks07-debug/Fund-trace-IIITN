from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from fastapi import HTTPException, status

from app.models.ngo import NGO
from app.models.user import User
from app.schemas.ngo import NGOCreate, NGOUpdate, NGOStatusUpdate


def calculate_transparency_score(ngo: NGO) -> float:
    """Calculate transparency score (0 - 100) based on documentation, verification & ledger readiness."""
    score = 45.0
    if ngo.verification_status == "VERIFIED":
        score += 20.0
    elif ngo.verification_status == "REJECTED":
        score -= 20.0
    
    if ngo.has_80g_certificate:
        score += 10.0
    if ngo.has_12a_certificate:
        score += 10.0
    if ngo.has_fcra_registration:
        score += 5.0
    if ngo.darpan_id:
        score += 5.0
    if ngo.wallet_address and len(ngo.wallet_address.strip()) > 10:
        score += 5.0  # Blockchain audit enabled
    
    return max(0.0, min(100.0, round(score, 1)))


def get_ngo_by_id(db: Session, ngo_id: int) -> Optional[NGO]:
    return db.query(NGO).filter(NGO.id == ngo_id, NGO.is_active == True).first()


def get_ngo_by_user_id(db: Session, user_id: int) -> Optional[NGO]:
    return db.query(NGO).filter(NGO.user_id == user_id, NGO.is_active == True).first()


def get_ngo_by_registration_number(db: Session, reg_num: str) -> Optional[NGO]:
    return db.query(NGO).filter(NGO.registration_number == reg_num).first()


def create_ngo(db: Session, ngo_in: NGOCreate, user_id: Optional[int] = None) -> NGO:
    # Check registration number uniqueness
    existing_reg = db.query(NGO).filter(NGO.registration_number == ngo_in.registration_number).first()
    if existing_reg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An NGO with registration number '{ngo_in.registration_number}' already exists."
        )

    # Check Darpan ID uniqueness if provided
    if ngo_in.darpan_id:
        existing_darpan = db.query(NGO).filter(NGO.darpan_id == ngo_in.darpan_id).first()
        if existing_darpan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An NGO with Darpan ID '{ngo_in.darpan_id}' already exists."
            )

    ngo_data = ngo_in.model_dump()
    if user_id:
        ngo_data["user_id"] = user_id

    db_ngo = NGO(**ngo_data)
    db_ngo.transparency_score = calculate_transparency_score(db_ngo)

    db.add(db_ngo)
    db.commit()
    db.refresh(db_ngo)
    return db_ngo


def list_ngos(
    db: Session,
    search: Optional[str] = None,
    category: Optional[str] = None,
    verification_status: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[NGO], int]:
    query = db.query(NGO).filter(NGO.is_active == True)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                NGO.name.ilike(search_filter),
                NGO.registration_number.ilike(search_filter),
                NGO.darpan_id.ilike(search_filter),
                NGO.city.ilike(search_filter),
                NGO.description.ilike(search_filter),
            )
        )

    if category and category.lower() != "all":
        query = query.filter(NGO.category.ilike(category))

    if verification_status and verification_status.lower() != "all":
        query = query.filter(NGO.verification_status == verification_status.upper())

    if city and city.lower() != "all":
        query = query.filter(NGO.city.ilike(f"%{city}%"))

    total = query.count()
    items = query.order_by(NGO.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def update_ngo(db: Session, ngo_id: int, ngo_in: NGOUpdate) -> NGO:
    db_ngo = get_ngo_by_id(db, ngo_id)
    if not db_ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NGO with ID {ngo_id} not found."
        )

    update_data = ngo_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ngo, key, value)

    # Recalculate transparency score
    db_ngo.transparency_score = calculate_transparency_score(db_ngo)
    db_ngo.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_ngo)
    return db_ngo


def update_ngo_status(
    db: Session,
    ngo_id: int,
    status_in: NGOStatusUpdate,
    auditor_id: Optional[int] = None
) -> NGO:
    db_ngo = get_ngo_by_id(db, ngo_id)
    if not db_ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NGO with ID {ngo_id} not found."
        )

    normalized_status = status_in.verification_status.upper()
    valid_statuses = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]
    if normalized_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification status. Must be one of: {valid_statuses}"
        )

    db_ngo.verification_status = normalized_status
    if status_in.verification_notes is not None:
        db_ngo.verification_notes = status_in.verification_notes

    if normalized_status == "VERIFIED":
        db_ngo.verified_at = datetime.utcnow()
        if auditor_id:
            db_ngo.verified_by_user_id = auditor_id

    db_ngo.transparency_score = calculate_transparency_score(db_ngo)
    db_ngo.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_ngo)
    return db_ngo


def delete_ngo(db: Session, ngo_id: int) -> bool:
    db_ngo = get_ngo_by_id(db, ngo_id)
    if not db_ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NGO with ID {ngo_id} not found."
        )
    # Soft delete
    db_ngo.is_active = False
    db_ngo.updated_at = datetime.utcnow()
    db.commit()
    return True


def get_ngo_statistics(db: Session, ngo_id: int) -> dict:
    db_ngo = get_ngo_by_id(db, ngo_id)
    if not db_ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NGO with ID {ngo_id} not found."
        )

    utilization_rate = 0.0
    if db_ngo.total_funds_received > 0:
        utilization_rate = round((db_ngo.total_funds_utilized / db_ngo.total_funds_received) * 100, 2)

    return {
        "ngo_id": db_ngo.id,
        "name": db_ngo.name,
        "total_funds_received": db_ngo.total_funds_received,
        "total_funds_utilized": db_ngo.total_funds_utilized,
        "utilization_rate": utilization_rate,
        "active_projects_count": db_ngo.active_projects_count,
        "beneficiaries_count": db_ngo.beneficiaries_count,
        "transparency_score": db_ngo.transparency_score,
        "verification_status": db_ngo.verification_status,
        "compliance": {
            "has_80g": db_ngo.has_80g_certificate,
            "has_12a": db_ngo.has_12a_certificate,
            "has_fcra": db_ngo.has_fcra_registration,
            "fcra_number": db_ngo.fcra_number,
            "darpan_id": db_ngo.darpan_id,
            "wallet_registered": bool(db_ngo.wallet_address and len(db_ngo.wallet_address) > 10)
        }
    }


def seed_sample_ngos_if_empty(db: Session):
    count = db.query(NGO).count()
    if count > 0:
        return

    sample_ngos = [
        NGO(
            name="Vidya Jyoti Foundation",
            legal_name="Vidya Jyoti Educational Trust India",
            registration_number="MH-NGP-2018-00452",
            darpan_id="MH/2018/0198421",
            pan_number="AAATV1234F",
            category="Education",
            mission="Empowering underprivileged children with tech-enabled modern education and digital literacy across rural Maharashtra.",
            vision="A world where quality education is accessible to every child regardless of socio-economic background.",
            description="Vidya Jyoti runs 28 digital community classrooms, provides stem kits, and trains teachers in rural school districts.",
            founding_year=2018,
            contact_email="contact@vidyajyoti.org",
            contact_phone="+91-98234-56789",
            website="https://vidyajyoti.org",
            logo_url="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=150&q=80",
            address="14, Seminary Hills",
            city="Nagpur",
            state="Maharashtra",
            pincode="440006",
            country="India",
            operating_regions="Nagpur, Wardha, Bhandara, Chandrapur",
            bank_name="State Bank of India",
            bank_account_number="309182390112",
            bank_ifsc="SBIN0004512",
            wallet_address="0x71C84013476f5b783abE7C351724C164539Db89a",
            verification_status="VERIFIED",
            verification_notes="All legal documents, 80G, 12A, and Darpan ID verified by National Auditor Board.",
            verified_at=datetime.utcnow(),
            has_80g_certificate=True,
            has_12a_certificate=True,
            has_fcra_registration=True,
            fcra_number="083780512",
            transparency_score=95.0,
            total_funds_received=4500000.0,
            total_funds_utilized=3820000.0,
            active_projects_count=6,
            beneficiaries_count=12400,
        ),
        NGO(
            name="Arogya Seva Trust",
            legal_name="Arogya Seva Healthcare & Relief Foundation",
            registration_number="DL-ND-2020-00918",
            darpan_id="DL/2020/0248102",
            pan_number="AABCA5678K",
            category="Healthcare",
            mission="Delivering preventive healthcare, mobile diagnostic clinics, and critical medicine supply to tribal and remote areas.",
            vision="Universal health coverage and zero preventable deaths from lack of primary medical care.",
            description="Operates a fleet of 12 mobile clinics equipped with tele-medicine facilities and basic path labs.",
            founding_year=2020,
            contact_email="info@arogyaseva.org",
            contact_phone="+91-98101-23456",
            website="https://arogyaseva.org",
            logo_url="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=150&q=80",
            address="Plot 55, Institutional Area, Sector 44",
            city="Gurugram",
            state="Haryana",
            pincode="122003",
            country="India",
            operating_regions="NCR, Rajasthan, Haryana, Himachal Pradesh",
            bank_name="HDFC Bank",
            bank_account_number="50200038918273",
            bank_ifsc="HDFC0001204",
            wallet_address="0x28C6c06298d514Db089934071355E5743bf21d60",
            verification_status="VERIFIED",
            verification_notes="Tax certificates and medical officer oversight verified.",
            verified_at=datetime.utcnow(),
            has_80g_certificate=True,
            has_12a_certificate=True,
            has_fcra_registration=False,
            transparency_score=90.0,
            total_funds_received=7800000.0,
            total_funds_utilized=6950000.0,
            active_projects_count=8,
            beneficiaries_count=35000,
        ),
        NGO(
            name="Vana Raksha Mission",
            legal_name="Vana Raksha Ecology & Reforestation Society",
            registration_number="KA-BLR-2022-00312",
            darpan_id="KA/2022/0311490",
            pan_number="AAACV9012M",
            category="Environment",
            mission="Reforesting degraded western ghats corridors and fostering community-led water shed management.",
            vision="Restored biodiversity corridors and carbon-neutral self-sustaining community forests.",
            description="Planted over 300,000 native species trees with geotagged tracking and survival monitoring.",
            founding_year=2022,
            contact_email="grow@vanaraksha.eco",
            contact_phone="+91-98450-89123",
            website="https://vanaraksha.eco",
            logo_url="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=150&q=80",
            address="72, Eco Green Hub, Indiranagar",
            city="Bengaluru",
            state="Karnataka",
            pincode="560038",
            country="India",
            operating_regions="Karnataka Western Ghats, Nilgiris",
            bank_name="ICICI Bank",
            bank_account_number="000201589302",
            bank_ifsc="ICIC0000002",
            wallet_address="0x1F98431c8aD98523631AE4a59f267346ea31F984",
            verification_status="PENDING",
            verification_notes="Registration submitted; awaiting field inspection report.",
            has_80g_certificate=True,
            has_12a_certificate=True,
            has_fcra_registration=False,
            transparency_score=80.0,
            total_funds_received=2100000.0,
            total_funds_utilized=1500000.0,
            active_projects_count=3,
            beneficiaries_count=8500,
        ),
    ]

    for ngo in sample_ngos:
        db.add(ngo)
    db.commit()

