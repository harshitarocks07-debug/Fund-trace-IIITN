from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class UserRole(str, Enum):
    DONOR = "Donor"
    NGO_ADMIN = "NGO admin"
    AUDITOR = "Auditor"

    @classmethod
    def normalize(cls, role_str: str) -> "UserRole":
        clean = role_str.strip().lower().replace("_", " ")
        if clean in ("donor", "donors"):
            return cls.DONOR
        elif clean in ("ngo admin", "ngo", "ngo_admin", "admin"):
            return cls.NGO_ADMIN
        elif clean in ("auditor", "audit"):
            return cls.AUDITOR
        raise ValueError(f"Unknown role '{role_str}'. Allowed roles: Donor, NGO admin, Auditor.")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.DONOR.value)
    organization = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to NGO profile
    ngo_profile = relationship("NGO", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} email={self.email} role={self.role}>"
