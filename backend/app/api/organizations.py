from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_organization, require_role
from app.models import Organization, User, UserRole, SubscriptionPlan
from app.schemas import OrganizationOut, BrandingUpdate

router = APIRouter(prefix="/api/organization", tags=["organization"])


@router.get("", response_model=OrganizationOut)
def current_organization(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    plan = db.get(SubscriptionPlan, org.plan_id) if org.plan_id else None
    out = OrganizationOut.model_validate(org)
    out.plan_code = plan.code if plan else None
    return out


@router.patch("/branding", response_model=OrganizationOut)
def update_branding(
    data: BrandingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.owner, UserRole.admin)),
    org: Organization = Depends(get_current_organization),
):
    if data.logo_url is not None:
        org.logo_url = data.logo_url
    if data.primary_color is not None:
        org.primary_color = data.primary_color
    if data.custom_domain is not None:
        org.custom_domain = data.custom_domain
    if data.report_footer is not None:
        org.report_footer = data.report_footer
    db.commit()
    db.refresh(org)
    plan = db.get(SubscriptionPlan, org.plan_id) if org.plan_id else None
    out = OrganizationOut.model_validate(org)
    out.plan_code = plan.code if plan else None
    return out


@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).all()
    return [
        {
            "code": p.code,
            "name": p.name,
            "price_monthly_eur": p.price_monthly_eur,
            "price_yearly_eur": p.price_yearly_eur,
            "max_tenants": p.max_tenants,
            "max_domains": p.max_domains,
            "scan_frequency_days": p.scan_frequency_days,
            "white_label_level": p.white_label_level,
        }
        for p in plans
    ]
