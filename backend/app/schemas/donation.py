from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict



class DonationBase(BaseModel):
    donor_name: str = Field(..., min_length=2, max_length=255, description="Full name or company name of donor")
    donor_email: Optional[str] = Field(None, description="Contact email for tax receipt delivery")
    donor_pan: Optional[str] = Field(None, max_length=20, description="Permanent Account Number for 80G tax benefit")
    amount: float = Field(..., gt=0, description="Donation amount (must be positive)")
    currency: str = Field("INR", max_length=10, description="Currency denomination")
    ngo_id: int = Field(..., description="Target NGO profile ID")
    project_id: Optional[int] = Field(None, description="Associated Project ID (optional)")
    payment_method: str = Field("UPI", description="UPI, CARD, BANK_TRANSFER, CRYPTO, CHEQUE")
    is_anonymous: bool = Field(False, description="Whether donor identity is kept confidential publicly")
    notes: Optional[str] = Field(None, description="Donation message or donor remarks")

    @field_validator("payment_method")
    def validate_payment_method(cls, v: str) -> str:
        allowed = {"UPI", "CARD", "BANK_TRANSFER", "CRYPTO", "CHEQUE"}
        upper_v = v.upper().strip()
        if upper_v not in allowed:
            raise ValueError(f"Invalid payment_method '{v}'. Allowed: {', '.join(sorted(allowed))}")
        return upper_v


class DonationCreate(DonationBase):
    tx_hash: Optional[str] = Field(None, description="Optional custom transaction hash or ref")
    status: str = Field("CONFIRMED", description="CONFIRMED, PENDING, FAILED")

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        allowed = {"CONFIRMED", "PENDING", "FAILED", "REFUNDED"}
        upper_v = v.upper().strip()
        if upper_v not in allowed:
            raise ValueError(f"Invalid status '{v}'. Allowed: {', '.join(sorted(allowed))}")
        return upper_v


class DonationUpdate(BaseModel):
    donor_name: Optional[str] = None
    donor_email: Optional[str] = None
    donor_pan: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[int] = None


class DonationResponse(DonationBase):
    id: int
    status: str
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    receipt_number: Optional[str] = None
    tax_benefit_claimed: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    ngo_name: Optional[str] = None
    project_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



class DonationReceipt(BaseModel):
    receipt_number: str
    date: datetime
    donor_name: str
    donor_pan: Optional[str] = None
    donor_email: Optional[str] = None
    amount: float
    currency: str
    payment_method: str
    tx_hash: Optional[str] = None
    ngo_id: int
    ngo_name: str
    ngo_registration_number: Optional[str] = None
    ngo_darpan_id: Optional[str] = None
    has_80g_certificate: bool = False
    project_id: Optional[int] = None
    project_title: Optional[str] = None
    verification_link: str


class DonationListResponse(BaseModel):
    items: List[DonationResponse]
    total: int
    total_amount: float
    skip: int
    limit: int


class DonationStats(BaseModel):
    total_donations: int
    total_amount: float
    average_amount: float
    currency: str = "INR"
    projects_funded_count: int
    by_project: List[Dict[str, Any]] = []
    monthly_trend: List[Dict[str, Any]] = []
    recent_donors: List[Dict[str, Any]] = []
