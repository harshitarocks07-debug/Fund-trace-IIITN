import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(50), primary_key=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    title = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    ngo = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="Education", index=True)

    # Budget & Financial Tracking
    target_budget = Column(Float, nullable=False, default=0.0)
    budget = Column(Float, nullable=False, default=0.0)
    raised_amount = Column(Float, default=0.0)
    raised = Column(Float, default=0.0)
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
    milestones = Column(Text, nullable=True)
    wallet_address = Column(String(66), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ngo_rel = relationship("NGO", back_populates="projects", foreign_keys=[ngo_id])
    donations = relationship("Donation", back_populates="project")
    expenses = relationship("Expense", back_populates="project")

    def __init__(self, **kwargs):
        # Auto-generate ID if not provided
        if "id" not in kwargs or kwargs["id"] is None:
            kwargs["id"] = f"PRJ-{uuid.uuid4().hex[:6].upper()}"
        else:
            kwargs["id"] = str(kwargs["id"])

        # Handle ngo argument if an NGO object was provided instead of a string
        if "ngo" in kwargs:
            val = kwargs.pop("ngo")
            if isinstance(val, str):
                kwargs["ngo"] = val
            elif val is not None:
                kwargs["ngo_rel"] = val
                kwargs["ngo"] = getattr(val, "name", "Helping Hands Foundation")

        # Sync title and name
        if "title" in kwargs and ("name" not in kwargs or not kwargs["name"]):
            kwargs["name"] = kwargs["title"]
        elif "name" in kwargs and ("title" not in kwargs or not kwargs["title"]):
            kwargs["title"] = kwargs["name"]

        # Sync target_budget and budget
        if "target_budget" in kwargs and ("budget" not in kwargs or not kwargs["budget"]):
            kwargs["budget"] = float(kwargs["target_budget"])
        elif "budget" in kwargs and ("target_budget" not in kwargs or not kwargs["target_budget"]):
            kwargs["target_budget"] = float(kwargs["budget"])

        # Sync raised and raised_amount
        if "raised_amount" in kwargs and ("raised" not in kwargs or not kwargs["raised"]):
            kwargs["raised"] = float(kwargs["raised_amount"])
        elif "raised" in kwargs and ("raised_amount" not in kwargs or not kwargs["raised_amount"]):
            kwargs["raised_amount"] = float(kwargs["raised"])

        super().__init__(**kwargs)
