from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base import Base


class FiatSettlement(Base):
    __tablename__ = "fiat_settlements"
    __table_args__ = (
        UniqueConstraint("provider", "event_id", name="uq_fiat_provider_event"),
    )

    id = Column(String(36), primary_key=True)
    provider = Column(String(64), nullable=False, index=True)
    event_id = Column(String(128), nullable=False)
    settlement_reference = Column(String(160), nullable=False, index=True)
    expense_id = Column(String(50), nullable=True, index=True)
    project_id = Column(String(50), nullable=True, index=True)
    evidence_hash = Column(String(64), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False)
    chain_id = Column(Integer, nullable=True)
    provider_status = Column(String(20), nullable=False)
    duplicate_evidence = Column(Boolean, nullable=False, default=False)
    review_status = Column(String(32), nullable=False, default="CLEAR")
    raw_event_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
