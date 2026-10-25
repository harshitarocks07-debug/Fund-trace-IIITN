from datetime import datetime
import secrets
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)

    # Core Expense Metadata
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="Operational", index=True)
    # Categories: Hardware, Logistics, Training, Materials, Salaries, Operational, Services, Medical

    # Financial Information
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_mode = Column(String(50), default="BANK_TRANSFER")  # BANK_TRANSFER, UPI, CARD, CHEQUE, CASH

    # Vendor & Invoice Details
    vendor_name = Column(String(255), nullable=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(DateTime, nullable=True)
    receipt_hash = Column(String(100), nullable=True)  # IPFS CID or cryptographic hash of uploaded bill
    receipt_url = Column(String(500), nullable=True)

    # Status & Audit Workflow
    # Statuses: PENDING, APPROVED, REJECTED, FLAGGED, REIMBURSED
    status = Column(String(50), default="PENDING", index=True)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    review_notes = Column(Text, nullable=True)

    # On-Chain Ledger Link
    tx_hash = Column(String(100), nullable=True, index=True)

    # Lifecycle & Soft-delete
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
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

