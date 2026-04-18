"""Generate executive PDF reports using WeasyPrint + Jinja2."""
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import get_settings
from app.models import (
    Tenant, Organization, Finding, Severity, FindingStatus,
    Report, ScoreHistory,
)

settings = get_settings()

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _grade_color(grade: str) -> str:
    return {
        "A": "#059669", "B": "#65A30D", "C": "#CA8A04",
        "D": "#EA580C", "F": "#DC2626",
    }.get(grade, "#6B7280")


def generate_report(db: Session, tenant_id, period_days: int = 30, user_id=None) -> Report:
    tenant: Tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise ValueError("tenant not found")
    org: Organization = db.get(Organization, tenant.organization_id)

    period_end = date.today()
    period_start = period_end - timedelta(days=period_days)

    findings_open = (
        db.query(Finding)
        .filter(
            Finding.tenant_id == tenant.id,
            Finding.status == FindingStatus.open,
        )
        .order_by(Finding.severity.desc(), Finding.last_seen_at.desc())
        .all()
    )
    by_sev_counts = {sev.value: 0 for sev in Severity}
    for f in findings_open:
        by_sev_counts[f.severity.value] += 1

    trend = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.tenant_id == tenant.id)
        .order_by(ScoreHistory.snapshot_date.desc())
        .limit(12)
        .all()
    )
    trend = list(reversed(trend))

    template = _env.get_template("report.html")
    html_rendered = template.render(
        tenant=tenant,
        org=org,
        generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
        score=tenant.current_score,
        grade=tenant.current_grade,
        grade_color=_grade_color(tenant.current_grade),
        by_sev_counts=by_sev_counts,
        findings=findings_open[:50],
        total_findings=len(findings_open),
        trend=[(h.snapshot_date.isoformat(), h.score) for h in trend],
        logo_url=org.logo_url,
        primary_color=org.primary_color or "#0F766E",
        report_footer=org.report_footer or "Condor EASM — External Attack Surface Report",
    )

    try:
        from weasyprint import HTML
        reports_dir = Path(settings.reports_dir)
        reports_dir.mkdir(parents=True, exist_ok=True)
        filename = f"condor_report_{tenant.id}_{period_end.isoformat()}.pdf"
        filepath = reports_dir / filename
        HTML(string=html_rendered).write_pdf(str(filepath))
    except Exception as e:
        # Fallback HTML file if WeasyPrint not available
        reports_dir = Path(settings.reports_dir)
        reports_dir.mkdir(parents=True, exist_ok=True)
        filename = f"condor_report_{tenant.id}_{period_end.isoformat()}.html"
        filepath = reports_dir / filename
        filepath.write_text(html_rendered)

    report = Report(
        tenant_id=tenant.id,
        organization_id=tenant.organization_id,
        period_start=period_start,
        period_end=period_end,
        file_path=str(filepath),
        summary={
            "score": tenant.current_score,
            "grade": tenant.current_grade,
            "findings_by_severity": by_sev_counts,
            "total_open_findings": len(findings_open),
        },
        generated_by_user_id=user_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
