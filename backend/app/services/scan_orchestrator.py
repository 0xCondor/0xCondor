"""Orchestrate scanners for a domain and persist results."""
from datetime import datetime, date, timezone
from typing import Iterable
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Tenant, Domain, Scan, ScanStatus, Asset, AssetType, Finding, Severity,
    FindingStatus, ScoreHistory,
)
from app.scanners import ALL_SCANNERS
from app.scanners.base import ScanContext, ScanResult
from app.core.scoring import compute_score

settings = get_settings()


def _merge_assets(db: Session, tenant_id, domain_id, raw_assets) -> None:
    now = datetime.now(timezone.utc)
    for ra in raw_assets:
        existing = (
            db.query(Asset)
            .filter(
                Asset.tenant_id == tenant_id,
                Asset.type == ra.type,
                Asset.value == ra.value,
            )
            .first()
        )
        if existing:
            existing.last_seen_at = now
            existing.is_active = True
            if ra.metadata:
                existing.metadata_ = {**(existing.metadata_ or {}), **ra.metadata}
        else:
            db.add(Asset(
                tenant_id=tenant_id,
                domain_id=domain_id,
                type=ra.type,
                value=ra.value,
                metadata_=ra.metadata or {},
                first_seen_at=now,
                last_seen_at=now,
                is_active=True,
            ))
    db.flush()


def _merge_findings(db: Session, tenant_id, scan_id, raw_findings) -> None:
    now = datetime.now(timezone.utc)
    for rf in raw_findings:
        existing = (
            db.query(Finding)
            .filter(
                Finding.tenant_id == tenant_id,
                Finding.check_id == rf.check_id,
                Finding.asset_value == rf.asset_value,
                Finding.fingerprint == rf.fingerprint,
            )
            .first()
        )
        if existing:
            if existing.status == FindingStatus.resolved:
                # reopen
                existing.status = FindingStatus.open
                existing.resolved_at = None
            existing.last_seen_at = now
            existing.occurrences = (existing.occurrences or 0) + 1
            existing.scan_id = scan_id
        else:
            db.add(Finding(
                tenant_id=tenant_id,
                scan_id=scan_id,
                check_id=rf.check_id,
                asset_value=rf.asset_value,
                fingerprint=rf.fingerprint,
                severity=rf.severity,
                title=rf.title,
                description=rf.description,
                remediation=rf.remediation,
                evidence=rf.evidence or {},
                first_seen_at=now,
                last_seen_at=now,
                status=FindingStatus.open,
            ))
    db.flush()


def _mark_missing_assets_inactive(db: Session, tenant_id, scan_start: datetime) -> None:
    # Assets not seen during this scan window -> mark inactive (soft deactivate)
    db.query(Asset).filter(
        Asset.tenant_id == tenant_id,
        Asset.last_seen_at < scan_start,
    ).update({"is_active": False}, synchronize_session=False)


def _auto_resolve_findings(db: Session, tenant_id, scan_start: datetime) -> None:
    db.query(Finding).filter(
        Finding.tenant_id == tenant_id,
        Finding.status == FindingStatus.open,
        Finding.last_seen_at < scan_start,
    ).update({"status": FindingStatus.resolved, "resolved_at": datetime.now(timezone.utc)}, synchronize_session=False)


def _update_tenant_score(db: Session, tenant: Tenant) -> None:
    from sqlalchemy import func
    rows = (
        db.query(Finding.severity, func.count(Finding.id))
        .filter(
            Finding.tenant_id == tenant.id,
            Finding.status == FindingStatus.open,
        )
        .group_by(Finding.severity)
        .all()
    )
    by_sev = {sev: 0 for sev in Severity}
    for sev, count in rows:
        by_sev[sev] = count
    score, grade, breakdown = compute_score(by_sev)
    tenant.current_score = score
    tenant.current_grade = grade
    tenant.last_scan_at = datetime.now(timezone.utc)

    today = date.today()
    existing = db.query(ScoreHistory).filter(
        ScoreHistory.tenant_id == tenant.id, ScoreHistory.snapshot_date == today
    ).first()
    if existing:
        existing.score = score
        existing.grade = grade
        existing.breakdown = breakdown
    else:
        db.add(ScoreHistory(
            tenant_id=tenant.id,
            snapshot_date=today,
            score=score,
            grade=grade,
            breakdown=breakdown,
        ))


def run_scan(db: Session, scan_id) -> None:
    """Run a full scan for a given Scan record. Intended to be called from Celery."""
    scan: Scan = db.get(Scan, scan_id)
    if not scan:
        return
    scan.status = ScanStatus.running
    scan.started_at = datetime.now(timezone.utc)
    db.commit()

    try:
        tenant: Tenant = db.get(Tenant, scan.tenant_id)
        domain: Domain = db.get(Domain, scan.domain_id) if scan.domain_id else None
        if not domain:
            raise ValueError("domain required for scan")
        if not domain.ownership_verified_at:
            raise ValueError("domain ownership not verified")

        ctx = ScanContext(
            domain=domain.fqdn,
            user_agent=settings.scan_user_agent,
            http_timeout=settings.scan_http_timeout_seconds,
            max_subdomains=settings.scan_max_subdomains,
        )
        scan_start = scan.started_at
        all_raw_assets = []
        all_raw_findings = []
        errors = []

        for scanner_cls in ALL_SCANNERS:
            scanner = scanner_cls()
            try:
                res: ScanResult = scanner.run(ctx)
                all_raw_assets.extend(res.assets)
                all_raw_findings.extend(res.findings)
                errors.extend([f"{scanner.name}: {e}" for e in res.errors])
            except Exception as e:
                errors.append(f"{scanner.name}: {e}")

        _merge_assets(db, tenant.id, domain.id, all_raw_assets)
        _merge_findings(db, tenant.id, scan.id, all_raw_findings)
        _mark_missing_assets_inactive(db, tenant.id, scan_start)
        _auto_resolve_findings(db, tenant.id, scan_start)
        _update_tenant_score(db, tenant)

        scan.status = ScanStatus.completed
        scan.finished_at = datetime.now(timezone.utc)
        scan.stats = {
            "assets_count": len(all_raw_assets),
            "findings_count": len(all_raw_findings),
            "subdomains_count": len(ctx.subdomains),
            "scanner_errors": errors[:20],
        }
        domain.last_scan_at = scan.finished_at
        db.commit()
    except Exception as e:
        scan.status = ScanStatus.failed
        scan.finished_at = datetime.now(timezone.utc)
        scan.error_message = str(e)[:1000]
        db.commit()
        raise
