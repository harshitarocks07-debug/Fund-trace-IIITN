import secrets
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(50), primary_key=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=True, index=True)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Core Expense Metadata
    title = Column(String(255), nullable=True, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="Operational", index=True)

    # Financial Information
    amount = Column(Float, nullable=False, default=0.0)
    claimed_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), default="INR", nullable=False)
    payment_mode = Column(String(50), default="BANK_TRANSFER")

    # Vendor & Invoice Details
    vendor = Column(String(255), nullable=True)
    vendor_name = Column(String(255), nullable=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(DateTime, nullable=True)
    receipt_name = Column(String(255), default="No receipt attached", nullable=True)
    receipt_hash = Column(String(100), nullable=True)
    receipt_url = Column(String(500), nullable=True)

    # OCR Extracted Fields
    extracted_amount = Column(Float, nullable=True)
    extracted_vendor = Column(String(255), nullable=True)
    extracted_invoice_number = Column(String(100), nullable=True)
    extracted_date = Column(String(50), nullable=True)

    # Status & Audit Workflow
    status = Column(String(50), default="PENDING", index=True)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)

    risk_score = Column(Integer, default=0, nullable=False)
    risk_reasons = Column(Text, default="[]", nullable=False)
    date = Column(String(50), nullable=True)

    # Blockchain Settlement & Attestation Fields
    blockchain_status = Column(String(50), default="Not submitted", nullable=False)
    blockchain_tx_hash = Column(String(66), nullable=True)
    blockchain_block_number = Column(Integer, nullable=True)
    blockchain_anchored_at = Column(DateTime(timezone=True), nullable=True)
    blockchain_commitment_root = Column(String(66), nullable=True)
    tx_hash = Column(String(100), nullable=True, index=True)

    # Lifecycle & Soft-delete
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now(), index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ngo = relationship("NGO", back_populates="expenses")
    project = relationship("Project", back_populates="expenses")

    @classmethod
    def generate_tx_hash(cls) -> str:
        return "0x" + secrets.token_hex(32)

    @classmethod
    def generate_receipt_hash(cls) -> str:
        return "Qm" + secrets.token_hex(22)

    def __init__(self, **kwargs):
        if "id" not in kwargs or kwargs["id"] is None:
            kwargs["id"] = f"EXP-{uuid.uuid4().hex[:6].upper()}"
        else:
            kwargs["id"] = str(kwargs["id"])

        # Sync amount and claimed_amount
        if "claimed_amount" in kwargs and ("amount" not in kwargs or not kwargs["amount"]):
            kwargs["amount"] = float(kwargs["claimed_amount"])
        elif "amount" in kwargs and ("claimed_amount" not in kwargs or not kwargs["claimed_amount"]):
            kwargs["claimed_amount"] = float(kwargs["amount"])

        # Sync vendor and vendor_name
        if "vendor_name" in kwargs and ("vendor" not in kwargs or not kwargs["vendor"]):
            kwargs["vendor"] = kwargs["vendor_name"]
        elif "vendor" in kwargs and ("vendor_name" not in kwargs or not kwargs["vendor_name"]):
            kwargs["vendor_name"] = kwargs["vendor"]

        # Sync title and vendor
        if "title" not in kwargs or not kwargs["title"]:
            kwargs["title"] = kwargs.get("vendor_name") or kwargs.get("vendor") or "Expense Claim"

        if "project_id" in kwargs and kwargs["project_id"] is not None:
            kwargs["project_id"] = str(kwargs["project_id"])

        if "date" not in kwargs or not kwargs["date"]:
            kwargs["date"] = datetime.utcnow().strftime("%Y-%m-%d")

        super().__init__(**kwargs)
