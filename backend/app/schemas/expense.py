from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator, ConfigDict, model_validator

ALLOWED_STATUSES = {"PENDING", "APPROVED", "REJECTED", "FLAGGED", "REIMBURSED", "Pending review", "More evidence"}
ALLOWED_PAYMENT_MODES = {"BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "CASH"}


class ExpenseBase(BaseModel):
    title: Optional[str] = Field(None, description="Clear description of the expense item or service")
    vendor: Optional[str] = Field(None, description="Merchant or vendor name")
    vendor_name: Optional[str] = Field(None, description="Merchant or vendor name")
    description: Optional[str] = Field(None, description="Detailed breakdown or justifications")
    category: str = Field("Operational", description="Category of expenditure")
    amount: Optional[float] = Field(None, description="Monetary cost")
    claimed_amount: Optional[float] = Field(None, description="Claimed monetary cost")
    claimedAmount: Optional[float] = Field(None, description="Claimed monetary cost (camelCase)")
    currency: str = Field("INR", max_length=10, description="Currency denomination")
    ngo_id: Optional[int] = Field(None, description="ID of the incurring NGO")
    project_id: Optional[Union[str, int]] = Field(None, description="Associated Project initiative ID")
    projectId: Optional[str] = Field(None, description="Associated Project ID (camelCase)")
    payment_mode: str = Field("BANK_TRANSFER", description="Payment mode used")
    invoice_number: Optional[str] = Field(None, description="Vendor tax invoice or bill number")
    invoiceNumber: Optional[str] = Field(None, description="Vendor tax invoice (camelCase)")
    invoice_date: Optional[datetime] = None
    receipt_name: Optional[str] = "No receipt attached"
    receiptName: Optional[str] = None
    receipt_hash: Optional[str] = ""
    receiptHash: Optional[str] = None
    receipt_url: Optional[str] = None

    @model_validator(mode="before")
    def sync_expense_fields(cls, data):
        if isinstance(data, dict):
            # Sync amount and claimedAmount
            amt = data.get("amount") or data.get("claimed_amount") or data.get("claimedAmount")
            if amt is not None:
                data["amount"] = float(amt)
                data["claimed_amount"] = float(amt)
                data["claimedAmount"] = float(amt)

            # Sync vendor and vendor_name
            vnd = data.get("vendor_name") or data.get("vendor") or data.get("title")
            if vnd:
                data["vendor"] = vnd
                data["vendor_name"] = vnd
                if not data.get("title"):
                    data["title"] = vnd

            # Sync invoiceNumber
            inv = data.get("invoice_number") or data.get("invoiceNumber")
            if inv:
                data["invoice_number"] = inv
                data["invoiceNumber"] = inv

            # Sync projectId
            pid = data.get("project_id") or data.get("projectId")
            if pid is not None:
                data["project_id"] = str(pid)
                data["projectId"] = str(pid)

            # Sync receiptName
            rn = data.get("receipt_name") or data.get("receiptName")
            if rn:
                data["receipt_name"] = rn
                data["receiptName"] = rn

            # Sync receiptHash
            rh = data.get("receipt_hash") or data.get("receiptHash")
            if rh:
                data["receipt_hash"] = rh
                data["receiptHash"] = rh
        return data


class ExpenseCreate(ExpenseBase):
    status: str = Field("PENDING", description="Initial lifecycle status")
    extractedAmount: Optional[float] = None
    extractedVendor: Optional[str] = None
    extractedInvoiceNumber: Optional[str] = None
    extractedDate: Optional[str] = None

    @model_validator(mode="after")
    def validate_create_fields(self):
        if not self.amount and not self.claimed_amount and not self.claimedAmount:
            raise ValueError("Expense amount must be specified and greater than zero.")
        amt = self.amount or self.claimed_amount or self.claimedAmount or 0.0
        self.amount = amt
        self.claimed_amount = amt
        self.claimedAmount = amt
        if not self.ngo_id:
            self.ngo_id = 1
        return self


class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[datetime] = None
    receipt_url: Optional[str] = None
    project_id: Optional[Union[str, int]] = None
    payment_mode: Optional[str] = None


class ExpenseStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: PENDING, APPROVED, REJECTED, FLAGGED, REIMBURSED")
    review_notes: Optional[str] = Field(None, description="Auditor justification or deficiency remarks")
    reviewed_by: Optional[str] = Field(None, description="Auditor identifier or reviewer name")


class ExpenseReview(BaseModel):
    status: str = Field(..., description="'Approved', 'Rejected', or 'More evidence'")
    reason: str = Field(..., min_length=3, description="Audit reason for the review decision")


class ExpenseResponse(ExpenseBase):
    id: Union[str, int]
    status: str = "PENDING"
    receipt_hash: Optional[str] = None
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    tx_hash: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    ngo_name: Optional[str] = None
    project_title: Optional[str] = None
    risk_score: Optional[int] = 0
    riskScore: Optional[int] = 0
    risk_reasons: Optional[List[str]] = []
    riskReasons: Optional[List[str]] = []
    date: Optional[str] = None
    blockchain_status: Optional[str] = "Not submitted"
    blockchainStatus: Optional[str] = "Not submitted"
    blockchain_tx_hash: Optional[str] = None
    blockchainTxHash: Optional[str] = None
    blockchain_block_number: Optional[int] = None
    blockchainBlockNumber: Optional[int] = None
    blockchain_anchored_at: Optional[datetime] = None
    blockchainAnchoredAt: Optional[datetime] = None
    blockchain_commitment_root: Optional[str] = None
    blockchainCommitmentRoot: Optional[str] = None
    extracted_amount: Optional[float] = None
    extractedAmount: Optional[float] = None
    extracted_vendor: Optional[str] = None
    extractedVendor: Optional[str] = None
    extracted_invoice_number: Optional[str] = None
    extractedInvoiceNumber: Optional[str] = None
    extracted_date: Optional[str] = None
    extractedDate: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ExpenseOut(BaseModel):
    id: str
    projectId: str = ""
    vendor: str = ""
    category: str = "Operational"
    invoiceNumber: str = ""
    claimedAmount: float = 0.0
    receiptName: str = ""
    receiptHash: str = ""
    extractedAmount: Optional[float] = None
    extractedVendor: Optional[str] = None
    extractedInvoiceNumber: Optional[str] = None
    extractedDate: Optional[str] = None
    status: str = "Pending review"
    riskScore: int = 0
    riskReasons: List[str] = []
    date: str = ""
    blockchainStatus: str = "Not submitted"
    blockchainTxHash: Optional[str] = None
    blockchainBlockNumber: Optional[int] = None
    blockchainAnchoredAt: Optional[datetime] = None
    blockchainCommitmentRoot: Optional[str] = None

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
