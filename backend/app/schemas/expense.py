from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict

ALLOWED_STATUSES = {"PENDING", "APPROVED", "REJECTED", "FLAGGED", "REIMBURSED"}
ALLOWED_CATEGORIES = {
    "HARDWARE",
    "LOGISTICS",
    "TRAINING",
    "MATERIALS",
    "SALARIES",
    "OPERATIONAL",
    "SERVICES",
    "MEDICAL",
    "GENERAL",
}
ALLOWED_PAYMENT_MODES = {"BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "CASH"}


class ExpenseBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Clear description of the expense item or service")
    description: Optional[str] = Field(None, description="Detailed breakdown or justifications")
    category: str = Field("Operational", description="Category of expenditure")
    amount: float = Field(..., gt=0, description="Monetary cost (must be positive)")
    currency: str = Field("INR", max_length=10, description="Currency denomination")
    ngo_id: int = Field(..., description="ID of the incurring NGO")
    project_id: Optional[int] = Field(None, description="Associated Project initiative ID (optional)")
    payment_mode: str = Field("BANK_TRANSFER", description="Payment mode used")
    vendor_name: Optional[str] = Field(None, max_length=255, description="Contractor, merchant, or vendor name")
    invoice_number: Optional[str] = Field(None, max_length=100, description="Vendor tax invoice or bill number")
    invoice_date: Optional[datetime] = Field(None, description="Date on vendor bill or invoice")
    receipt_url: Optional[str] = Field(None, max_length=500, description="Link or storage path to invoice scan")

    @field_validator("category")
    def validate_category(cls, v: str) -> str:
        upper_v = v.upper().strip()
        if upper_v not in ALLOWED_CATEGORIES:
            # Allow clean title casing if not strictly in uppercase set
            return v.strip().title()
        return v.strip().title()

    @field_validator("payment_mode")
    def validate_payment_mode(cls, v: str) -> str:
        upper_v = v.upper().strip()
        if upper_v not in ALLOWED_PAYMENT_MODES:
            raise ValueError(f"Invalid payment_mode '{v}'. Allowed: {', '.join(sorted(ALLOWED_PAYMENT_MODES))}")
        return upper_v


class ExpenseCreate(ExpenseBase):
    status: str = Field("PENDING", description="Initial lifecycle status")
    receipt_hash: Optional[str] = Field(None, description="Optional IPFS CID or SHA256 receipt hash")

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        upper_v = v.upper().strip()
        if upper_v not in ALLOWED_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Allowed: {', '.join(sorted(ALLOWED_STATUSES))}")
        return upper_v


class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[datetime] = None
    receipt_url: Optional[str] = None
    project_id: Optional[int] = None
    payment_mode: Optional[str] = None


class ExpenseStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: PENDING, APPROVED, REJECTED, FLAGGED, REIMBURSED")
    review_notes: Optional[str] = Field(None, description="Auditor justification or deficiency remarks")
    reviewed_by: Optional[str] = Field(None, description="Auditor identifier or reviewer name")

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        upper_v = v.upper().strip()
        if upper_v not in ALLOWED_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Allowed: {', '.join(sorted(ALLOWED_STATUSES))}")
        return upper_v


class ExpenseResponse(ExpenseBase):
    id: int
    status: str
    receipt_hash: Optional[str] = None
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    tx_hash: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    ngo_name: Optional[str] = None
    project_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ExpenseListResponse(BaseModel):
    items: List[ExpenseResponse]
    total: int
    total_amount: float
    approved_amount: float
    pending_amount: float
    skip: int
    limit: int


class ExpenseStats(BaseModel):
    total_expenses_count: int
    total_amount: float
    approved_amount: float
    pending_amount: float
    rejected_amount: float
    currency: str = "INR"
    by_category: List[Dict[str, Any]] = []
    by_project: List[Dict[str, Any]] = []
    recent_expenses: List[Dict[str, Any]] = []

