from fastapi import APIRouter
from app.api.v1.endpoints import auth, ngo, projects, donations, expenses

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(ngo.router, prefix="/ngos", tags=["NGO Management"])
api_router.include_router(projects.router, prefix="/projects", tags=["Project Management"])
api_router.include_router(donations.router, prefix="/donations", tags=["Donation Management"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["Expense Management"])


