from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Project Title")
    description: Optional[str] = Field(None, description="Detailed project description and objectives")
    category: str = Field("Education", description="Sector (Education, Healthcare, Environment, etc.)")
    target_budget: float = Field(..., gt=0, description="Total budget required for the project (in INR)")
    status: str = Field("PLANNING", description="Project status: PLANNING, ACTIVE, COMPLETED, PAUSED, CANCELLED")
    start_date: Optional[datetime] = Field(None, description="Project start date")
    end_date: Optional[datetime] = Field(None, description="Project target completion date")
    location: Optional[str] = Field(None, description="Geographic location of project execution")
    beneficiaries_target: int = Field(0, ge=0, description="Target number of beneficiaries")
    milestones: Optional[str] = Field(None, description="Key deliverables and milestone schedule")
    wallet_address: Optional[str] = Field(None, max_length=66, description="Cryptographic escrow / fund tracking wallet")


class ProjectCreate(ProjectBase):
    ngo_id: int = Field(..., description="ID of the sponsoring NGO")


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_budget: Optional[float] = Field(None, gt=0)
    raised_amount: Optional[float] = Field(None, ge=0)
    utilized_amount: Optional[float] = Field(None, ge=0)
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    beneficiaries_target: Optional[int] = Field(None, ge=0)
    beneficiaries_reached: Optional[int] = Field(None, ge=0)
    milestones: Optional[str] = None
    wallet_address: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectStatusUpdate(BaseModel):
    status: str = Field(..., description="PLANNING, ACTIVE, COMPLETED, PAUSED, CANCELLED")
    beneficiaries_reached: Optional[int] = Field(None, ge=0, description="Updated count of beneficiaries served")
    status_notes: Optional[str] = Field(None, description="Reason for status change or update note")


class ProjectResponse(ProjectBase):
    id: int
    ngo_id: int
    raised_amount: float
    utilized_amount: float
    beneficiaries_reached: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    ngo_name: Optional[str] = None

    # Computed financial health fields
    funding_progress_pct: float = 0.0
    budget_utilization_pct: float = 0.0
    remaining_budget: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
    skip: int
    limit: int


class ProjectBudgetSummary(BaseModel):
    project_id: int
    title: str
    target_budget: float
    raised_amount: float
    utilized_amount: float
    funding_percentage: float
    utilization_percentage: float
    unutilized_funds: float
    budget_gap: float
    status: str
    beneficiaries_target: int
    beneficiaries_reached: int

