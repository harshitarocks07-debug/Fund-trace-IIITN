from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class NGOBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Official Name of the NGO")
    legal_name: Optional[str] = Field(None, max_length=255, description="Registered legal name")
    registration_number: str = Field(..., min_length=3, max_length=100, description="Unique registration/society number")
    darpan_id: Optional[str] = Field(None, max_length=100, description="NGO Darpan Portal ID")
    pan_number: Optional[str] = Field(None, max_length=20, description="PAN Tax ID")
    category: str = Field("Education", description="Sector or category (Education, Healthcare, Environment, etc.)")
    mission: Optional[str] = Field(None, description="Core mission statement")
    vision: Optional[str] = Field(None, description="Vision statement")
    description: Optional[str] = Field(None, description="Detailed description of activities")
    founding_year: Optional[int] = Field(None, ge=1800, le=2100, description="Year of establishment")

    contact_email: str = Field(..., description="Official contact email")
    contact_phone: str = Field(..., description="Official contact phone number")
    website: Optional[str] = Field(None, description="Official website URL")
    logo_url: Optional[str] = Field(None, description="URL of organization logo")
    cover_image_url: Optional[str] = Field(None, description="Cover or banner image URL")

    address: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, description="City")
    state: Optional[str] = Field(None, description="State / Province")
    pincode: Optional[str] = Field(None, description="Postal / PIN code")
    country: str = Field("India", description="Country")
    operating_regions: Optional[str] = Field(None, description="Operating cities/districts/regions")

    bank_name: Optional[str] = Field(None, description="Bank Name")
    bank_account_number: Optional[str] = Field(None, description="Bank Account Number")
    bank_ifsc: Optional[str] = Field(None, description="Bank IFSC / Branch Code")
    wallet_address: Optional[str] = Field(None, max_length=66, description="Cryptographic wallet address for fund tracing")

    has_80g_certificate: bool = Field(False, description="Whether 80G tax exemption certificate is available")
    has_12a_certificate: bool = Field(False, description="Whether 12A registration certificate is available")
    has_fcra_registration: bool = Field(False, description="Whether FCRA approval is present for international funds")
    fcra_number: Optional[str] = Field(None, description="FCRA Registration Number")


class NGOCreate(NGOBase):
    user_id: Optional[int] = Field(None, description="Associated user ID")


class NGOUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    category: Optional[str] = None
    mission: Optional[str] = None
    vision: Optional[str] = None
    description: Optional[str] = None
    founding_year: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    operating_regions: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    wallet_address: Optional[str] = None
    has_80g_certificate: Optional[bool] = None
    has_12a_certificate: Optional[bool] = None
    has_fcra_registration: Optional[bool] = None
    fcra_number: Optional[str] = None
    total_funds_received: Optional[float] = None
    total_funds_utilized: Optional[float] = None
    active_projects_count: Optional[int] = None
    beneficiaries_count: Optional[int] = None
    is_active: Optional[bool] = None


class NGOStatusUpdate(BaseModel):
    verification_status: str = Field(..., description="New status: PENDING, VERIFIED, REJECTED, SUSPENDED")
    verification_notes: Optional[str] = Field(None, description="Auditor/Admin justification or notes")


class NGOResponse(NGOBase):
    id: int
    user_id: Optional[int] = None
    verification_status: str
    verification_notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by_user_id: Optional[int] = None
    transparency_score: float
    total_funds_received: float
    total_funds_utilized: float
    active_projects_count: int
    beneficiaries_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NGOListResponse(BaseModel):
    items: List[NGOResponse]
    total: int
    skip: int
    limit: int


class NGOStats(BaseModel):
    ngo_id: int
    name: str
    total_funds_received: float
    total_funds_utilized: float
    utilization_rate: float
    active_projects_count: int
    beneficiaries_count: int
    transparency_score: float
    verification_status: str
    compliance: dict

