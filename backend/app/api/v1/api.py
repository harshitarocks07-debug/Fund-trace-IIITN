from fastapi import APIRouter
from app.api.v1.endpoints import auth, projects, donations, expenses, receipts, audit, blockchain, flows

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(donations.router, prefix="/donations", tags=["Donations"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["Expenses"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["Receipts"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Log"])
api_router.include_router(blockchain.router, prefix="/blockchain", tags=["Blockchain Impact Ledger"])
api_router.include_router(flows.router, prefix="/flows", tags=["Multi-Hop Financial Flow Tracker"])
