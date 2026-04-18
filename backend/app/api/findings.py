from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_organization
from app.models import Finding, FindingStatus, Severity, Tenant, User, Organization
from app.schemas import FindingOut, FindingUpdate

router = APIRouter(prefix="/api/tenants/{tenant_id}/findings", tags=["findings"])


def _assert_tenant(db, tenant_id, org):
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    return t


SEVERITY_ORDER = {Severity.critical: 5, Severity.high: 4, Severity.medium: 3, Severity.low: 2, Severity.info: 1}


@router.get("", response_model=list[FindingOut])
def list_findings(
    tenant_id: UUID,
    status: str | None = Query(None),
    severity: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    q = db.query(Finding).filter(Finding.tenant_id == tenant_id)
    if status:
        try:
            q = q.filter(Finding.status == FindingStatus(status))
        except ValueError:
            raise HTTPException(400, "status non valido")
    if severity:
        try:
            q = q.filter(Finding.severity == Severity(severity))
        except ValueError:
            raise HTTPException(400, "severity non valida")

    findings = q.order_by(Finding.last_seen_at.desc()).limit(limit).all()
    findings.sort(key=lambda f: (SEVERITY_ORDER[f.severity], f.last_seen_at), reverse=True)
    return findings


@router.patch("/{finding_id}", response_model=FindingOut)
def update_finding(
    tenant_id: UUID,
    finding_id: UUID,
    data: FindingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    f = db.query(Finding).filter(Finding.id == finding_id, Finding.tenant_id == tenant_id).first()
    if not f:
        raise HTTPException(404, "finding non trovato")
    try:
        new_status = FindingStatus(data.status)
    except ValueError:
        raise HTTPException(400, "status non valido")
    f.status = new_status
    if new_status == FindingStatus.resolved:
        f.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(f)
    return f
