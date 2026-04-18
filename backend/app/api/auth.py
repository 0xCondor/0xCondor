import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Organization, SubscriptionPlan, UserRole, AuditLog
from app.schemas import RegisterRequest, LoginRequest, TokenPair, MeResponse
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:60] or "org"


@router.post("/register", response_model=TokenPair)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email.lower()).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "email già registrata")

    base_slug = _slugify(data.organization_name)
    slug = base_slug
    n = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        n += 1
        slug = f"{base_slug}-{n}"

    default_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == "trial").first()
    org = Organization(name=data.organization_name, slug=slug, plan_id=default_plan.id if default_plan else None)
    db.add(org)
    db.flush()

    user = User(
        organization_id=org.id,
        email=data.email.lower(),
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=UserRole.owner,
    )
    db.add(user)
    db.add(AuditLog(
        organization_id=org.id,
        user_id=user.id,
        action="organization.created",
        resource_type="organization",
        resource_id=str(org.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
        metadata_={"email": data.email.lower()},
    ))
    db.commit()

    return TokenPair(
        access_token=create_access_token(str(user.id), {"org": str(org.id), "role": user.role.value}),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenPair)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "credenziali non valide")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "account disattivato")
    user.last_login_at = datetime.utcnow()
    db.add(AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="user.login",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
    ))
    db.commit()
    return TokenPair(
        access_token=create_access_token(str(user.id), {"org": str(user.organization_id), "role": user.role.value}),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenPair)
def refresh(token: str, db: Session = Depends(get_db)):
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise ValueError("wrong token type")
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user inactive")
    return TokenPair(
        access_token=create_access_token(str(user.id), {"org": str(user.organization_id), "role": user.role.value}),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.organization_id)
    plan = db.get(SubscriptionPlan, org.plan_id) if org.plan_id else None
    return MeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        organization_id=org.id,
        organization_name=org.name,
        plan_code=plan.code if plan else None,
    )
