from datetime import datetime

from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base, engine, SessionLocal


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False
    )

    purpose: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )

    budget_rupees: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# Automatically initialize schema in blackhole.db on import
Base.metadata.create_all(bind=engine)


def seed_sample_projects():
    db = SessionLocal()
    try:
        if db.query(Project).count() == 0:
            sample_projects = [
                Project(
                    name="Rural Digital Classrooms",
                    purpose="Deploying solar-powered tablets and educational tools in rural schools.",
                    budget_rupees=1500000,
                ),
                Project(
                    name="STEM Science & Robotics Kits",
                    purpose="Equipping secondary school laboratories with hands-on mechanics and electronics kits.",
                    budget_rupees=600000,
                ),
                Project(
                    name="Clean Water Well Infrastructure",
                    purpose="Solar pump borewells across drought-prone villages.",
                    budget_rupees=850000,
                ),
            ]
            db.add_all(sample_projects)
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


seed_sample_projects()
