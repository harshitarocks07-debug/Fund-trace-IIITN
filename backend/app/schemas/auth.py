from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict
from app.models.user import UserRole


class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = UserRole.DONOR.value
    organization: Optional[str] = None


class UserCreate(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password with at least 6 characters")
    full_name: str = Field(..., min_length=1, description="Full name of user")
    role: str = Field(default=UserRole.DONOR.value, description="Role: 'Donor', 'NGO admin', or 'Auditor'")
    organization: Optional[str] = Field(default=None, description="Optional organization name")


class UserLogin(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    organization: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


UserResponse = UserOut


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenPayload(BaseModel):
    sub: str
    email: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class PermissionCheckResponse(BaseModel):
    role: str
    permissions: List[str]
    capabilities: Dict[str, bool]
