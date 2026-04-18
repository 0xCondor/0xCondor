from uuid import UUID
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user, get_current_organization
from app.models import (
    Tenant, User, Organization, Finding, FindingStatus, Severity,
    ScoreHistory, SubscriptionPlan,
)
from app.schemas import TenantCreate, TenantOut, TenantListItem

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


@router.get("", response_model=list[TenantListItem])
def list_tenants(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    tenants = db.query(Tenant).filter(Tenant.organization_id == org.id).order_by(Tenant.current_score).all()
    result = []
    week_ago = date.today() - timedelta(days=7)
    for t in tenants:
        open_counts = dict(
            db.query(Finding.severity, func.count(Finding.id))
            .filter(Finding.tenant_id == t.id, Finding.status == FindingStatus.open)
            .group_by(Finding.severity).all()
        )
        prev = (
            db.query(ScoreHistory)
            .filter(ScoreHistory.tenant_id == t.id, ScoreHistory.snapshot_date <= week_ago)
            .order_by(ScoreHistory.snapshot_date.desc())
            .first()
        )
        delta = t.current_score - (prev.score if prev else t.current_score)
        result.append(TenantListItem(
            id=t.id,
            name=t.name,
            current_score=t.current_score,
            current_grade=t.current_grade,
            last_scan_at=t.last_scan_at,
            findings_open=sum(open_counts.values()),
            findings_critical=open_counts.get(Severity.critical, 0),
            findings_high=open_counts.get(Severity.high, 0),
            delta_7d=delta,
        ))
    return result


@router.post("", response_model=TenantOut, status_code=201)
def create_tenant(
    data: TenantCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    plan = db.get(SubscriptionPlan, org.plan_id) if org.plan_id else None
    if plan:
        current_count = db.query(func.count(Tenant.id)).filter(Tenant.organization_id == org.id).scalar()
        if current_count >= plan.max_tenants:
            raise HTTPException(402, f"limite piano raggiunto: max {plan.max_tenants} tenant. Upgrade necessario.")

    tenant = Tenant(
        organization_id=org.id,
        name=data.name,
        contact_email=data.contact_email,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    return t


@router.get("/{tenant_id}/score-history")
def score_history(
    tenant_id: UUID,
    days: int = Query(90, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    cutoff = date.today() - timedelta(days=days)
    rows = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.tenant_id == tenant_id, ScoreHistory.snapshot_date >= cutoff)
        .order_by(ScoreHistory.snapshot_date)
        .all()
    )
    return [{"date": r.snapshot_date.isoformat(), "score": r.score, "grade": r.grade} for r in rows]


@router.delete("/{tenant_id}", status_code=204)
def delete_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    db.delete(t)
    db.commit()
