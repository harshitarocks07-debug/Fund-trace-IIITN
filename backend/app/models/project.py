from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="Education", index=True)

    # Budget & Financial Tracking
    target_budget = Column(Float, nullable=False, default=0.0)
    raised_amount = Column(Float, default=0.0)
    utilized_amount = Column(Float, default=0.0)

    # Project Lifecycle Status
    status = Column(String(50), default="PLANNING", index=True)  # PLANNING, ACTIVE, COMPLETED, PAUSED, CANCELLED

    # Timeline & Geography
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    location = Column(String(255), nullable=True)

    # Impact Metrics
    beneficiaries_target = Column(Integer, default=0)
    beneficiaries_reached = Column(Integer, default=0)

    # Milestones & Traceability
    milestones = Column(Text, nullable=True)  # JSON or structured string of deliverables
    wallet_address = Column(String(66), nullable=True)  # Project-specific smart contract / vault address

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to parent NGO
    ngo = relationship("NGO", back_populates="projects")
    donations = relationship("Donation", back_populates="project")
    expenses = relationship("Expense", back_populates="project")


