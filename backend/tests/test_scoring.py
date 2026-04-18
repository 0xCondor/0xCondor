from app.core.scoring import compute_score
from app.models import Severity


def test_no_findings_is_A():
    score, grade, _ = compute_score({sev: 0 for sev in Severity})
    assert score == 100
    assert grade == "A"


def test_critical_heavily_penalizes():
    score, grade, _ = compute_score({Severity.critical: 2, Severity.high: 0, Severity.medium: 0, Severity.low: 0, Severity.info: 0})
    assert score == 50
    assert grade in ("D", "C")


def test_capped_penalties():
    # Many low findings capped
    score, _, breakdown = compute_score({Severity.critical: 0, Severity.high: 0, Severity.medium: 0, Severity.low: 100, Severity.info: 0})
    assert breakdown["low"] == 10


def test_f_grade():
    score, grade, _ = compute_score({Severity.critical: 10, Severity.high: 10, Severity.medium: 20, Severity.low: 50, Severity.info: 0})
    assert grade == "F"
    assert score < 40
