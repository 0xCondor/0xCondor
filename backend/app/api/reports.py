import os
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_organization
from app.models import Report, Tenant, User, Organization
from app.schemas import ReportOut
from app.services.report_generator import generate_report

router = APIRouter(prefix="/api/tenants/{tenant_id}/reports", tags=["reports"])


def _assert_tenant(db, tenant_id, org):
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    return t


@router.get("", response_model=list[ReportOut])
def list_reports(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    return db.query(Report).filter(Report.tenant_id == tenant_id).order_by(Report.generated_at.desc()).limit(50).all()


@router.post("", response_model=ReportOut, status_code=201)
def create_report(
    tenant_id: UUID,
    period_days: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    report = generate_report(db, tenant_id, period_days=period_days, user_id=user.id)
    return report


@router.get("/{report_id}/download")
def download_report(
    tenant_id: UUID,
    report_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _assert_tenant(db, tenant_id, org)
    r = db.query(Report).filter(Report.id == report_id, Report.tenant_id == tenant_id).first()
    if not r or not r.file_path or not os.path.exists(r.file_path):
        raise HTTPException(404, "report non disponibile")
    media_type = "application/pdf" if r.file_path.endswith(".pdf") else "text/html"
    filename = f"condor_report_{r.period_end}.pdf" if r.file_path.endswith(".pdf") else f"condor_report_{r.period_end}.html"
    return FileResponse(r.file_path, media_type=media_type, filename=filename)
