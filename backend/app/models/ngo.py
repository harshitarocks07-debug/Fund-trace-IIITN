from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class NGO(Base):
    __tablename__ = "ngos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Basic Identification
    name = Column(String(255), nullable=False, index=True)
    legal_name = Column(String(255), nullable=True)
    registration_number = Column(String(100), unique=True, index=True, nullable=False)
    darpan_id = Column(String(100), unique=True, nullable=True, index=True)
    pan_number = Column(String(20), nullable=True)

    # Categorization & Overview
    category = Column(String(100), nullable=False, default="Education", index=True)
    mission = Column(Text, nullable=True)
    vision = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    founding_year = Column(Integer, nullable=True)

    # Contact & Media
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(50), nullable=False)
    website = Column(String(255), nullable=True)
    logo_url = Column(String(500), nullable=True)
    cover_image_url = Column(String(500), nullable=True)

    # Address & Operating Region
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True, index=True)
    pincode = Column(String(20), nullable=True)
    country = Column(String(100), default="India")
    operating_regions = Column(Text, nullable=True)  # Comma-separated or JSON string

    # Financial & Blockchain Traceability
    bank_name = Column(String(150), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_ifsc = Column(String(30), nullable=True)
    wallet_address = Column(String(66), nullable=True, index=True)  # Ethereum/EVM hex address (0x...)

    # Compliance & Certifications
    verification_status = Column(String(50), default="PENDING", index=True)  # PENDING, VERIFIED, REJECTED, SUSPENDED
    verification_notes = Column(Text, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by_user_id = Column(Integer, nullable=True)
    has_80g_certificate = Column(Boolean, default=False)
    has_12a_certificate = Column(Boolean, default=False)
    has_fcra_registration = Column(Boolean, default=False)
    fcra_number = Column(String(50), nullable=True)

    # Transparency & Impact Metrics
    transparency_score = Column(Float, default=75.0)  # 0 to 100
    total_funds_received = Column(Float, default=0.0)
    total_funds_utilized = Column(Float, default=0.0)
    active_projects_count = Column(Integer, default=0)
    beneficiaries_count = Column(Integer, default=0)

    # Status & Timestamps
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="ngo_profile")
    projects = relationship("Project", back_populates="ngo", cascade="all, delete-orphan")
    donations = relationship("Donation", back_populates="ngo", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="ngo", cascade="all, delete-orphan")


