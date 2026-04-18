from collections import Counter
from app.models import Severity


SEVERITY_POINTS = {
    Severity.critical: 25,
    Severity.high: 10,
    Severity.medium: 3,
    Severity.low: 1,
    Severity.info: 0,
}
SEVERITY_CAP = {
    Severity.critical: 50,
    Severity.high: 40,
    Severity.medium: 25,
    Severity.low: 10,
    Severity.info: 0,
}


def compute_score(findings_by_severity: dict[Severity, int]) -> tuple[int, str, dict]:
    """Return (score 0-100, letter grade, breakdown dict)."""
    score = 100
    breakdown: dict[str, int] = {}
    for sev, count in findings_by_severity.items():
        raw = SEVERITY_POINTS[sev] * count
        capped = min(raw, SEVERITY_CAP[sev])
        score -= capped
        breakdown[sev.value] = capped
    score = max(0, min(100, score))

    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"
    return score, grade, breakdown


def score_from_findings(findings: list) -> tuple[int, str, dict]:
    c = Counter(f.severity for f in findings if getattr(f, "status", None) in (None, "open") or str(getattr(f, "status", "open")) == "open")
    by_sev = {sev: c.get(sev, 0) for sev in Severity}
    return compute_score(by_sev)
