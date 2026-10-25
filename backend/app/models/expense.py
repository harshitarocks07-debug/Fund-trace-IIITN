from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(50), primary_key=True, index=True)
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    vendor = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    invoice_number = Column(String(100), nullable=False)
    claimed_amount = Column(Float, nullable=False)
    receipt_name = Column(String(255), nullable=False)
    receipt_hash = Column(String(64), nullable=False)
    
    # OCR Extracted Fields
    extracted_amount = Column(Float, nullable=True)
    extracted_vendor = Column(String(255), nullable=True)
    extracted_invoice_number = Column(String(100), nullable=True)
    extracted_date = Column(String(50), nullable=True)

    status = Column(String(50), default="Pending review", nullable=False)
    risk_score = Column(Integer, default=0, nullable=False)
    risk_reasons = Column(Text, default="[]", nullable=False)
    date = Column(String(50), nullable=False)
    
    # Blockchain Settlement & Attestation Fields
    blockchain_status = Column(String(50), default="Not submitted", nullable=False)
    blockchain_tx_hash = Column(String(66), nullable=True)
    blockchain_block_number = Column(Integer, nullable=True)
    blockchain_anchored_at = Column(DateTime(timezone=True), nullable=True)
    blockchain_commitment_root = Column(String(66), nullable=True)

    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
