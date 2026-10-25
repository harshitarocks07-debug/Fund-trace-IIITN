from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserOut,
    Token,
    PermissionCheckResponse,
)
from app.core.security import hash_password, verify_password, create_access_token
from app.core.permissions import get_current_user, get_role_capabilities

router = APIRouter()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user with a specified role (Donor, NGO Admin, or Auditor)."""
    email_clean = user_in.email.strip().lower()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    try:
        validated_role = UserRole.normalize(user_in.role).value
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    user = User(
        email=email_clean,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        role=validated_role,
        organization=user_in.organization.strip() if user_in.organization else None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=user.id,
        claims={"email": user.email, "role": user.role}
    )

    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=Token)
def login_user(login_in: UserLogin, db: Session = Depends(get_db)):
    """Authenticate a user with email and password, returning a JWT token."""
    email_clean = login_in.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your user account is inactive. Please contact support.",
        )

    token = create_access_token(
        subject=user.id,
        claims={"email": user.email, "role": user.role}
    )

    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Return profile information for currently logged-in user."""
    return UserOut.model_validate(current_user)


@router.get("/permissions", response_model=PermissionCheckResponse)
def get_current_permissions(current_user: User = Depends(get_current_user)):
    """Return explicit role capabilities and permission scopes for the logged-in user."""
    caps = get_role_capabilities(current_user.role)
    return PermissionCheckResponse(
        role=caps["role"],
        permissions=caps["permissions"],
        capabilities=caps["capabilities"],
    )


@router.get("/demo-users")
def get_demo_credentials():
    """Return standard pre-configured demo credentials for quick switching and testing."""
    return [
        {
            "role": UserRole.DONOR.value,
            "name": "Aarav Mehta",
            "email": "donor@aarav.org",
            "password": "Password123!",
            "description": "Can browse projects, make donations, and inspect personal donation impact.",
        },
        {
            "role": UserRole.NGO_ADMIN.value,
            "name": "Helping Hands Admin",
            "email": "admin@helpinghands.org",
            "password": "Password123!",
            "description": "Can create projects, submit expenses with receipt fingerprints, and monitor budget.",
        },
        {
            "role": UserRole.AUDITOR.value,
            "name": "Priya Nair",
            "email": "auditor@trustcheck.org",
            "password": "Password123!",
            "description": "Can review expenses, verify receipt SHA-256 hashes, approve/reject claims, and inspect audit logs.",
        },
    ]
