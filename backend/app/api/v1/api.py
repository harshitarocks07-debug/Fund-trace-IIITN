from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    ngo,
    projects,
    donations,
    expenses,
    receipts,
    audit,
    blockchain,
    flows,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(ngo.router, prefix="/ngos", tags=["NGO Management"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects & Budgets"])
api_router.include_router(donations.router, prefix="/donations", tags=["Donations & Receipts"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["Expenses & Audit"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["Receipts & Invoices"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Log"])
api_router.include_router(blockchain.router, prefix="/blockchain", tags=["Blockchain Impact Ledger"])
api_router.include_router(flows.router, prefix="/flows", tags=["Multi-Hop Financial Flow Tracker"])
