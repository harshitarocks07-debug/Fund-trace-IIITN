from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import user, ngo, project, donation, expense  # ensure models are registered
from app.services.ngo_service import seed_sample_ngos_if_empty
from app.services.project_service import seed_sample_projects_if_empty
from app.services.donation_service import seed_sample_donations_if_empty
from app.services.expense_service import seed_sample_expenses_if_empty
from app.api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    # Seed sample NGO, Project, Donation, and Expense data for immediate exploration
    db = SessionLocal()
    try:
        seed_sample_ngos_if_empty(db)
        seed_sample_projects_if_empty(db)
        seed_sample_donations_if_empty(db)
        seed_sample_expenses_if_empty(db)
    finally:
        db.close()
    yield




app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for FundTrace: Transparent NGO fund tracing, profile management, and verification.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "status": "online",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}

