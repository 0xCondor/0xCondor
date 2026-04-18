from app.scanners.base import RawFinding
from app.models import Severity


def test_fingerprint_stable():
    a = RawFinding(check_id="x", severity=Severity.low, title="t", asset_value="v", evidence={"k": 1})
    b = RawFinding(check_id="x", severity=Severity.low, title="other", asset_value="v", evidence={"k": 1})
    assert a.fingerprint == b.fingerprint


def test_fingerprint_changes_with_evidence():
    a = RawFinding(check_id="x", severity=Severity.low, title="t", asset_value="v", evidence={"k": 1})
    c = RawFinding(check_id="x", severity=Severity.low, title="t", asset_value="v", evidence={"k": 2})
    assert a.fingerprint != c.fingerprint
