from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class Donation(Base):
    __tablename__ = "donations"

    id = Column(String(50), primary_key=True, index=True)
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False)
    donor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    donor_name = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(String(50), nullable=False)
    reference = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

