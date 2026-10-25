from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

class ReceiptOCRResult(BaseModel):
    vendor: Optional[str] = None
    invoiceNumber: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    confidence: float = 0.0
    ocrStatus: str = "COMPLETED"
    rawText: Optional[str] = None
    warnings: List[str] = []

    model_config = ConfigDict(from_attributes=True)

class ReceiptOut(BaseModel):
    id: str
    original_filename: str
    file_size: int
    mime_type: str
    sha256_hash: str
    expense_id: Optional[str] = None
    uploaded_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    
    # OCR Extracted Fields
    extracted_vendor: Optional[str] = None
    extracted_invoice_number: Optional[str] = None
    extracted_date: Optional[str] = None
    extracted_amount: Optional[float] = None
    ocr_confidence: Optional[float] = None
    ocr_status: Optional[str] = None
    raw_text: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ReceiptVerifyRequest(BaseModel):
    receiptHash: str = Field(..., min_length=64, max_length=64, description="SHA-256 hex digest of file")

class ReceiptVerifyResponse(BaseModel):
    receiptHash: str
    isDuplicate: bool
    matchingExpenses: List[str]
    matchingReceipts: List[str]
    message: str
    ocrResult: Optional[ReceiptOCRResult] = None
