from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.permissions import require_ngo_admin_or_auditor

router = APIRouter()

class AuditEntryOut(BaseModel):
    id: str
    expenseId: str
    action: str
    actor: str
    reason: str
    date: str

    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[AuditEntryOut])
def get_audit_trail(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """View the audit log. Restricted to NGO Admins and Auditors; Donors are forbidden."""
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).all()
    return [
        AuditEntryOut(
            id=log.id,
            expenseId=log.expense_id,
            action=log.action,
            actor=log.actor,
            reason=log.reason,
            date=log.date,
        )
        for log in logs
    ]
