from pydantic import BaseModel, Field, ConfigDict

class DonationCreate(BaseModel):
    projectId: str
    amount: float = Field(..., gt=0)

class DonationOut(BaseModel):
    id: str
    projectId: str
    donor: str
    amount: float
    date: str
    reference: str

    model_config = ConfigDict(from_attributes=True)
