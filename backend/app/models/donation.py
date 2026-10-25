from datetime import datetime
import secrets
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class Donation(Base):
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)

    # Donor Information
    donor_name = Column(String(255), nullable=False, index=True)
    donor_email = Column(String(255), nullable=True)
    donor_pan = Column(String(20), nullable=True)  # Required for Indian 80G tax receipt
    is_anonymous = Column(Boolean, default=False)

    # Financial Information
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_method = Column(String(50), default="UPI")  # UPI, CARD, BANK_TRANSFER, CRYPTO, CHEQUE
    status = Column(String(50), default="CONFIRMED", index=True)  # PENDING, CONFIRMED, FAILED, REFUNDED

    # On-Chain and Statutory Verification
    tx_hash = Column(String(100), nullable=True, unique=True, index=True)  # Blockchain tx hash or payment gateway ref
    block_number = Column(Integer, nullable=True)
    receipt_number = Column(String(50), nullable=True, unique=True, index=True)  # 80G Tax receipt ref
    tax_benefit_claimed = Column(Boolean, default=False)

    # Purpose and Notes
    notes = Column(Text, nullable=True)

    # System Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
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

