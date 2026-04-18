from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_organization
from app.models import Scan, ScanStatus, ScanType, Tenant, Domain, User, Organization
from app.schemas import ScanOut, ScanCreate
from app.tasks.scan_tasks import run_scan_task

router = APIRouter(prefix="/api/tenants/{tenant_id}/scans", tags=["scans"])


def _assert_tenant(db, tenant_id, org):
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    return t


@router.get("", response_model=list[ScanOut])
def list_scans(
    tenant_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    return db.query(Scan).filter(Scan.tenant_id == tenant_id).order_by(Scan.created_at.desc()).limit(limit).all()


@router.post("", response_model=ScanOut, status_code=202)
def trigger_scan(
    tenant_id: UUID,
    data: ScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    d = db.query(Domain).filter(Domain.id == data.domain_id, Domain.tenant_id == tenant_id).first()
    if not d:
        raise HTTPException(404, "dominio non trovato")
    if not d.ownership_verified_at:
        raise HTTPException(400, "ownership del dominio non verificata: impossibile lanciare scan")

    scan = Scan(
        tenant_id=tenant_id,
        domain_id=d.id,
        type=ScanType.manual,
        status=ScanStatus.queued,
        triggered_by_user_id=user.id,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    try:
        run_scan_task.delay(str(scan.id))
    except Exception:
        # Celery not available — run synchronously (dev only)
        from app.services.scan_orchestrator import run_scan
        run_scan(db, scan.id)
    return scan


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    tenant_id: UUID,
    scan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    s = db.query(Scan).filter(Scan.id == scan_id, Scan.tenant_id == tenant_id).first()
    if not s:
        raise HTTPException(404, "scan non trovato")
    return s
