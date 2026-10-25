from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base

class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(String(50), primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    sanitized_filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    sha256_hash = Column(String(64), nullable=False, index=True)
    expense_id = Column(String(50), ForeignKey("expenses.id"), nullable=True, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # OCR Extracted Metadata
    extracted_vendor = Column(String(255), nullable=True)
    extracted_invoice_number = Column(String(100), nullable=True)
    extracted_date = Column(String(50), nullable=True)
    extracted_amount = Column(Float, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    ocr_status = Column(String(50), default="NOT_PROCESSED", nullable=True)
    raw_text = Column(Text, nullable=True)

    def __repr__(self):
        return f"<Receipt id={self.id} hash={self.sha256_hash[:12]}... file={self.original_filename} ocr={self.ocr_status}>"
