import secrets
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Donation(Base):
    __tablename__ = "donations"

    id = Column(String(50), primary_key=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=True, index=True)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    donor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Donor Information
    donor_name = Column(String(255), nullable=False, index=True)
    donor_email = Column(String(255), nullable=True)
    donor_pan = Column(String(20), nullable=True)  # Required for Indian 80G tax receipt
    donor_phone = Column(String(50), nullable=True)
    is_anonymous = Column(Boolean, default=False)

    # Financial Information
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_method = Column(String(50), default="UPI")  # UPI, CARD, BANK_TRANSFER, CRYPTO, CHEQUE
    status = Column(String(50), default="CONFIRMED", index=True)  # PENDING, CONFIRMED, FAILED, REFUNDED

    # On-Chain and Statutory Verification
    tx_hash = Column(String(100), nullable=True, unique=True, index=True)
    block_number = Column(Integer, nullable=True)
    blockchain_status = Column(String(50), nullable=False, default="Not submitted")
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_block_number = Column(Integer, nullable=True)
    blockchain_anchored_at = Column(DateTime(timezone=True), nullable=True)
    blinding_salt = Column(String(66), nullable=True)
    commitment_hash = Column(String(66), nullable=True, index=True)
    payment_status = Column(String(50), nullable=False, default="Pending")
    payment_tx_hash = Column(String(100), nullable=True)
    payment_verified_at = Column(DateTime(timezone=True), nullable=True)
    payment_verified_by = Column(String(255), nullable=True)
    receipt_number = Column(String(50), nullable=True, unique=True, index=True)  # 80G Tax receipt ref
    tax_benefit_claimed = Column(Boolean, default=False)
    date = Column(String(50), nullable=True)
    reference = Column(String(100), nullable=True)

    # Purpose and Notes
    notes = Column(Text, nullable=True)

    # System Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now(), index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ngo = relationship("NGO", back_populates="donations")
    project = relationship("Project", back_populates="donations")

    @classmethod
    def generate_receipt_number(cls) -> str:
        date_str = datetime.utcnow().strftime("%Y%m%d")
        random_suffix = secrets.token_hex(3).upper()
        return f"REC-{date_str}-{random_suffix}"

    @classmethod
    def generate_tx_hash(cls) -> str:
        return "0x" + secrets.token_hex(32)

    def __init__(self, **kwargs):
        if "id" not in kwargs or kwargs["id"] is None:
            kwargs["id"] = f"DON-{uuid.uuid4().hex[:6].upper()}"
        else:
            kwargs["id"] = str(kwargs["id"])

        if "receipt_number" not in kwargs or not kwargs["receipt_number"]:
            kwargs["receipt_number"] = self.generate_receipt_number()

        if "tx_hash" not in kwargs or not kwargs["tx_hash"]:
            kwargs["tx_hash"] = self.generate_tx_hash()

        if "reference" not in kwargs or not kwargs["reference"]:
            kwargs["reference"] = kwargs["tx_hash"]

        if "date" not in kwargs or not kwargs["date"]:
            kwargs["date"] = datetime.utcnow().strftime("%Y-%m-%d")

        if "project_id" in kwargs and kwargs["project_id"] is not None:
            kwargs["project_id"] = str(kwargs["project_id"])

        super().__init__(**kwargs)
