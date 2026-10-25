from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

class ReceiptOCRResult(BaseModel):
    vendor: Optional[str] = None
    vendorAddress: Optional[str] = None
    gstin: Optional[str] = None
    invoiceNumber: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    quantityUnit: Optional[str] = None
    unitPrice: Optional[float] = None
    subtotal: Optional[float] = None
    taxAmount: Optional[float] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    paymentStatus: Optional[str] = None
    paymentReference: Optional[str] = None
    dueDate: Optional[str] = None
    arithmeticConsistent: Optional[bool] = None
    duplicateInvoice: bool = False
    duplicateFile: bool = False
    missingFields: List[str] = Field(default_factory=list)
    originalFilename: Optional[str] = None
    fileHash: Optional[str] = None
    confidence: float = 0.0
    ocrStatus: str = "COMPLETED"
    rawText: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)

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
    extracted_vendor_address: Optional[str] = None
    extracted_gstin: Optional[str] = None
    extracted_description: Optional[str] = None
    extracted_quantity: Optional[float] = None
    extracted_quantity_unit: Optional[str] = None
    extracted_unit_price: Optional[float] = None
    extracted_subtotal: Optional[float] = None
    extracted_tax_amount: Optional[float] = None
    extracted_currency: Optional[str] = None
    extracted_payment_status: Optional[str] = None
    extracted_payment_reference: Optional[str] = None
    extracted_due_date: Optional[str] = None
    arithmetic_consistent: Optional[bool] = None
    duplicate_invoice: bool = False
    duplicate_file: bool = False

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
