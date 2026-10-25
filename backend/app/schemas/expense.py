from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class ExpenseCreate(BaseModel):
    projectId: str
    vendor: str = Field(..., min_length=2)
    category: str = Field(..., min_length=2)
    invoiceNumber: str = Field(..., min_length=1)
    claimedAmount: float = Field(..., gt=0)
    receiptName: str = Field(default="No receipt attached")
    receiptHash: str = Field(default="")
    extractedAmount: Optional[float] = None
    extractedVendor: Optional[str] = None
    extractedInvoiceNumber: Optional[str] = None
    extractedDate: Optional[str] = None

class ExpenseReview(BaseModel):
    status: str = Field(..., description="'Approved', 'Rejected', or 'More evidence'")
    reason: str = Field(..., min_length=3, description="Audit reason for the review decision")

class ExpenseOut(BaseModel):
    id: str
    projectId: str
    vendor: str
    category: str
    invoiceNumber: str
    claimedAmount: float
    receiptName: str
    receiptHash: str
    extractedAmount: Optional[float] = None
    extractedVendor: Optional[str] = None
    extractedInvoiceNumber: Optional[str] = None
    extractedDate: Optional[str] = None
    status: str
    riskScore: int
    riskReasons: List[str]
    date: str
    blockchainStatus: str = "Not submitted"
    blockchainTxHash: Optional[str] = None
    blockchainBlockNumber: Optional[int] = None
    blockchainAnchoredAt: Optional[datetime] = None
    blockchainCommitmentRoot: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
