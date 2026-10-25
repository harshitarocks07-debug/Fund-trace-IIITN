from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class FiatSettlementWebhook(BaseModel):
    eventId: str = Field(..., min_length=1, max_length=128)
    settlementReference: str = Field(..., min_length=1, max_length=160)
    expenseId: Optional[str] = Field(default=None, max_length=50)
    projectId: Optional[str] = Field(default=None, max_length=50)
    evidenceHash: str = Field(..., pattern=r"^(0x)?[a-fA-F0-9]{64}$")
    amount: float = Field(..., gt=0, allow_inf_nan=False)
    currency: str = Field(..., min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")
    chainId: Optional[int] = Field(default=None, gt=0)
    status: Literal["pending", "settled", "failed"]


class FiatSettlementOut(BaseModel):
    id: str
    provider: str
    event_id: str
    settlement_reference: str
    expense_id: Optional[str] = None
    project_id: Optional[str] = None
    evidence_hash: str
    amount: float
    currency: str
    chain_id: Optional[int] = None
    provider_status: str
    duplicate_evidence: bool
    review_status: str
    raw_event_hash: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
