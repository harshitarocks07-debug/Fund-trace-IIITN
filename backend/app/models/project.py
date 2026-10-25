from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    ngo = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    budget = Column(Float, nullable=False)
    raised = Column(Float, default=0.0, nullable=False)
    location = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

