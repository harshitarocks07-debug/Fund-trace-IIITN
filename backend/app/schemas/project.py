from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: str = Field(..., min_length=5)
    budget: float = Field(..., gt=0)
    location: str = Field(..., min_length=2)
    category: str = Field(..., min_length=2)

class ProjectOut(BaseModel):
    id: str
    name: str
    ngo: str
    description: str
    budget: float
    raised: float
    location: str
    category: str

    model_config = ConfigDict(from_attributes=True)
