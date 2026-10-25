from typing import List, Union, Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.core.security import decode_access_token

security_scheme = HTTPBearer(auto_error=False)

def get_role_capabilities(role: str) -> Dict[str, Any]:
    """Return explicit permission flags and capability matrix for a given role."""
    clean_role = role.strip()
    
    if clean_role == UserRole.NGO_ADMIN.value:
        return {
            "role": UserRole.NGO_ADMIN.value,
            "permissions": [
                "projects:create",
                "projects:read",
                "expenses:create",
                "expenses:read",
                "receipts:read",
                "donations:read_all",
                "audit:read"
            ],
            "capabilities": {
                "can_create_project": True,
                "can_submit_expense": True,
                "can_review_expense": False,
                "can_donate": False,
                "can_verify_receipts": True,
                "can_view_audit_log": True,
            }
        }
    elif clean_role == UserRole.AUDITOR.value:
        return {
            "role": UserRole.AUDITOR.value,
            "permissions": [
                "projects:read",
                "expenses:read",
                "expenses:review",
                "receipts:verify",
                "audit:read",
                "audit:create"
            ],
            "capabilities": {
                "can_create_project": False,
                "can_submit_expense": False,
                "can_review_expense": True,
                "can_donate": False,
                "can_verify_receipts": True,
                "can_view_audit_log": True,
            }
        }
    else:  # Default to Donor
        return {
            "role": UserRole.DONOR.value,
            "permissions": [
                "projects:read",
                "donations:create",
                "donations:read_own"
            ],
            "capabilities": {
                "can_create_project": False,
                "can_submit_expense": False,
                "can_review_expense": False,
                "can_donate": True,
                "can_verify_receipts": False,
                "can_view_audit_log": False,
            }
        }

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    try:
        user_id_int = int(user_id)
        user = db.query(User).filter(User.id == user_id_int).first()
    except ValueError:
        user = db.query(User).filter(User.email == user_id).first()
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
        
    return user

def require_role(allowed_roles: Union[UserRole, List[UserRole], List[str]]):
    """Enforces that the current authenticated user has one of the specified roles."""
    if not isinstance(allowed_roles, list):
        allowed_roles = [allowed_roles]
        
    normalized_allowed = [
        r.value if isinstance(r, UserRole) else UserRole.normalize(r).value
        for r in allowed_roles
    ]

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: role '{current_user.role}' is not authorized for this action. Required role: {', '.join(normalized_allowed)}"
            )
        return current_user

    return role_checker

# Predefined role dependencies
require_donor = require_role([UserRole.DONOR])
require_ngo_admin = require_role([UserRole.NGO_ADMIN])
require_auditor = require_role([UserRole.AUDITOR])
require_ngo_admin_or_auditor = require_role([UserRole.NGO_ADMIN, UserRole.AUDITOR])
