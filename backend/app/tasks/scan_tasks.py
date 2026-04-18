import uuid
from datetime import datetime, timezone, timedelta
from celery.utils.log import get_task_logger

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models import Scan, ScanStatus, ScanType, Domain, Tenant, Organization
from app.services.scan_orchestrator import run_scan
from app.services.report_generator import generate_report
from app.services.domain_validator import check_dns_txt_ownership

log = get_task_logger(__name__)


@celery_app.task(name="app.tasks.scan_tasks.run_scan_task")
def run_scan_task(scan_id: str) -> dict:
    log.info(f"Starting scan {scan_id}")
    db = SessionLocal()
    try:
        run_scan(db, uuid.UUID(scan_id))
        return {"ok": True, "scan_id": scan_id}
    except Exception as e:
        log.exception(f"scan {scan_id} failed: {e}")
        return {"ok": False, "scan_id": scan_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.scan_tasks.schedule_periodic_scans")
def schedule_periodic_scans() -> dict:
    """Enqueue a scan for domains that need one based on their plan frequency."""
    db = SessionLocal()
    scheduled = 0
    try:
        now = datetime.now(timezone.utc)
        domains = db.query(Domain).filter(Domain.ownership_verified_at.isnot(None)).all()
        for d in domains:
            tenant = db.get(Tenant, d.tenant_id)
            if not tenant:
                continue
            org = db.get(Organization, tenant.organization_id)
            plan_freq = (org.plan.scan_frequency_days if org and org.plan else 7)
            if d.last_scan_at and d.last_scan_at > now - timedelta(days=plan_freq):
                continue
            scan = Scan(
                tenant_id=tenant.id,
                domain_id=d.id,
                type=ScanType.incremental,
                status=ScanStatus.queued,
            )
            db.add(scan)
            db.commit()
            run_scan_task.delay(str(scan.id))
            scheduled += 1
        return {"scheduled": scheduled}
    finally:
        db.close()


@celery_app.task(name="app.tasks.scan_tasks.generate_report_task")
def generate_report_task(tenant_id: str, period_days: int = 30, user_id: str | None = None) -> dict:
    db = SessionLocal()
    try:
        r = generate_report(db, uuid.UUID(tenant_id), period_days=period_days,
                            user_id=uuid.UUID(user_id) if user_id else None)
        return {"ok": True, "report_id": str(r.id), "file": r.file_path}
    finally:
        db.close()


@celery_app.task(name="app.tasks.scan_tasks.verify_domain_task")
def verify_domain_task(domain_id: str) -> dict:
    db = SessionLocal()
    try:
        d = db.get(Domain, uuid.UUID(domain_id))
        if not d:
            return {"ok": False, "error": "domain not found"}
        d.last_verification_attempt_at = datetime.now(timezone.utc)
        verified = check_dns_txt_ownership(d)
        if verified:
            d.ownership_verified_at = datetime.now(timezone.utc)
        db.commit()
        return {"ok": True, "verified": verified}
    finally:
        db.close()


@celery_app.task(name="app.tasks.scan_tasks.daily_score_snapshot")
def daily_score_snapshot() -> dict:
    from app.services.scan_orchestrator import _update_tenant_score
    db = SessionLocal()
    count = 0
    try:
        for t in db.query(Tenant).all():
            _update_tenant_score(db, t)
            count += 1
        db.commit()
        return {"updated": count}
    finally:
        db.close()
