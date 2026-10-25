from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator, ConfigDict, model_validator


class DonationBase(BaseModel):
    donor_name: Optional[str] = Field(None, description="Full name or company name of donor")
    donor_email: Optional[str] = Field(None, description="Contact email for tax receipt delivery")
    donor_pan: Optional[str] = Field(None, max_length=20, description="Permanent Account Number for 80G tax benefit")
    amount: float = Field(..., gt=0, description="Donation amount (must be positive)")
    currency: str = Field("INR", max_length=10, description="Currency denomination")
    ngo_id: Optional[int] = Field(None, description="Target NGO profile ID")
    project_id: Optional[Union[str, int]] = Field(None, description="Associated Project ID (optional)")
    projectId: Optional[str] = Field(None, description="Associated Project ID (camelCase)")
    payment_method: str = Field("UPI", description="UPI, CARD, BANK_TRANSFER, CRYPTO, CHEQUE")
    is_anonymous: bool = Field(False, description="Whether donor identity is kept confidential publicly")
    notes: Optional[str] = Field(None, description="Donation message or donor remarks")

    @model_validator(mode="before")
    def sync_project_id(cls, data):
        if isinstance(data, dict):
            for external, internal in (
                ("donorName", "donor_name"),
                ("donorEmail", "donor_email"),
                ("donorPhone", "donor_phone"),
                ("paymentMethod", "payment_method"),
                ("paymentReference", "payment_reference"),
            ):
                if external in data and internal not in data:
                    data[internal] = data[external]
            if "projectId" in data and not data.get("project_id"):
                data["project_id"] = data["projectId"]
            elif "project_id" in data and data.get("project_id") is not None and not data.get("projectId"):
                data["projectId"] = str(data["project_id"])
        return data

    @field_validator("payment_method")
    def validate_payment_method(cls, v: str) -> str:
        if not v:
            return "UPI"
        allowed = {"UPI", "CARD", "BANK_TRANSFER", "CRYPTO", "CHEQUE"}
        upper_v = v.upper().strip().replace(" ", "_")
        if upper_v not in allowed:
            raise ValueError(f"Invalid payment method: '{v}'. Permitted values: {', '.join(sorted(allowed))}")
        return upper_v


class DonationCreate(DonationBase):
    tx_hash: Optional[str] = Field(None, description="Optional custom transaction hash or ref")
    status: str = Field("CONFIRMED", description="CONFIRMED, PENDING, FAILED")
    donor_phone: Optional[str] = None
    payment_reference: Optional[str] = None

    @property
    def paymentReference(self) -> Optional[str]:
        return self.payment_reference

    @property
    def donorName(self) -> Optional[str]:
        return self.donor_name

    @property
    def donorEmail(self) -> Optional[str]:
        return self.donor_email

    @property
    def donorPhone(self) -> Optional[str]:
        return self.donor_phone

    @property
    def paymentMethod(self) -> str:
        return self.payment_method

    @model_validator(mode="after")
    def set_defaults(self):
        if not self.ngo_id:
            self.ngo_id = 1
        return self


class DonationUpdate(BaseModel):
    donor_name: Optional[str] = None
    donor_email: Optional[str] = None
    donor_pan: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[Union[str, int]] = None


class DonationResponse(DonationBase):
    id: Union[str, int]
    donor: Optional[str] = None
    date: Optional[str] = None
    reference: Optional[str] = None
    status: str = "CONFIRMED"
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    receipt_number: Optional[str] = None
    tax_benefit_claimed: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    ngo_name: Optional[str] = None
    project_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DonationOut(BaseModel):
    id: str
    projectId: str = ""
    donor: str = ""
    amount: float
    date: str = ""
    reference: str = ""
    paymentStatus: str = "Pending"
    paymentMethod: str = "Bank Transfer"
    paymentTxHash: Optional[str] = None
    paymentVerifiedAt: Optional[str] = None
    blockchainStatus: str = "Not submitted"
    commitmentHash: Optional[str] = None
    blockchainTxHash: Optional[str] = None
    blockchainBlockNumber: Optional[int] = None
    blindingSalt: Optional[str] = None

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
    project_id: Optional[Union[str, int]] = None
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

class DonationCommitmentVerifyRequest(BaseModel):
    donationId: str
    projectId: str
    amount: float
    paymentReference: str
    blindingSalt: str

class DonationCommitmentVerifyResponse(BaseModel):
    donationId: str
    verified: bool
    onChainVerified: bool
    isHashMatch: bool
    commitmentHash: str
    projectId: str
    amount: float
    blockchainBlockNumber: Optional[int] = None
    contractAddress: Optional[str] = None
    message: str
    piiStatus: str = "ZERO_PII_EXPOSED: Verified without revealing donor name, email, or contact information."

class DonationPaymentVerifyRequest(BaseModel):
    paymentTxHash: str
    paymentMethod: Optional[str] = "Bank Settlement"
    notes: Optional[str] = None

class DonationPaymentVerifyResponse(BaseModel):
    donationId: str
    paymentStatus: str
    paymentTxHash: str
    paymentVerifiedAt: str
    paymentMethod: str
    message: str
