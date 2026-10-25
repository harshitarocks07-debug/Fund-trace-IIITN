from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(50), primary_key=True, index=True)
    expense_id = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    actor = Column(String(255), nullable=False)
    actor_id = Column(Integer, nullable=True)
    reason = Column(String(255), nullable=False)
    date = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

