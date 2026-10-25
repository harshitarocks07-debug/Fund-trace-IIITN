from datetime import datetime
from typing import Optional, List, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProjectBase(BaseModel):
    title: Optional[str] = Field(None, description="Project Title")
    name: Optional[str] = Field(None, description="Project Name")
    description: Optional[str] = Field(None, description="Detailed project description and objectives")
    category: str = Field("Education", description="Sector (Education, Healthcare, Environment, etc.)")
    target_budget: Optional[float] = Field(None, description="Total budget required (in INR)")
    budget: Optional[float] = Field(None, description="Total budget required")
    status: str = Field("PLANNING", description="Project status: PLANNING, ACTIVE, COMPLETED, PAUSED, CANCELLED")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = "India"
    beneficiaries_target: int = Field(0, ge=0)
    milestones: Optional[str] = None
    wallet_address: Optional[str] = None

    @model_validator(mode="before")
    def sync_names_and_budget(cls, data):
        if isinstance(data, dict):
            # Sync title and name
            if not data.get("title") and data.get("name"):
                data["title"] = data["name"]
            elif not data.get("name") and data.get("title"):
                data["name"] = data["title"]

            # Sync budget and target_budget
            if data.get("budget") is not None and data.get("target_budget") is None:
                data["target_budget"] = float(data["budget"])
            elif data.get("target_budget") is not None and data.get("budget") is None:
                data["budget"] = float(data["target_budget"])
        return data


class ProjectCreate(ProjectBase):
    ngo_id: Optional[int] = Field(None, description="ID of the sponsoring NGO")
    ngo: Optional[str] = Field(None, description="Name of the sponsoring NGO")

    @model_validator(mode="after")
    def validate_budget_and_title(self):
        effective_budget = self.target_budget or self.budget
        if effective_budget is None or effective_budget <= 0:
            raise ValueError("Project budget must be greater than zero.")
        self.target_budget = effective_budget
        self.budget = effective_budget

        effective_title = self.title or self.name
        if not effective_title:
            raise ValueError("Project name or title is required.")
        self.title = effective_title
        self.name = effective_title
        return self


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_budget: Optional[float] = Field(None, gt=0)
    budget: Optional[float] = Field(None, gt=0)
    raised_amount: Optional[float] = Field(None, ge=0)
    raised: Optional[float] = Field(None, ge=0)
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
    id: Union[str, int]
    ngo_id: Optional[int] = None
    name: str = ""
    title: str = ""
    ngo: Optional[str] = None
    budget: float = 0.0
    raised: float = 0.0
    raised_amount: float = 0.0
    utilized_amount: float = 0.0
    beneficiaries_reached: int = 0
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    ngo_name: Optional[str] = None

    # Computed financial health fields
    funding_progress_pct: float = 0.0
    budget_utilization_pct: float = 0.0
    remaining_budget: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class ProjectOut(BaseModel):
    id: str
    name: str
    ngo: str = "Helping Hands Foundation"
    description: str = ""
    budget: float = 0.0
    raised: float = 0.0
    location: str = "India"
    category: str = "Education"

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
    skip: int
    limit: int


class ProjectBudgetSummary(BaseModel):
    project_id: Union[str, int]
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
