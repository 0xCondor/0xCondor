from __future__ import annotations
import hashlib
from dataclasses import dataclass, field
from typing import Any
from app.models import Severity, AssetType


@dataclass
class ScanContext:
    """Per-scan execution context passed across scanners."""
    domain: str
    subdomains: list[str] = field(default_factory=list)
    live_http: dict[str, dict] = field(default_factory=dict)  # url -> {status, title, headers, tech}
    dns_records: dict[str, list[str]] = field(default_factory=dict)
    user_agent: str = "CondorEASM/1.0"
    http_timeout: int = 8
    max_subdomains: int = 500


@dataclass
class RawAsset:
    type: AssetType
    value: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RawFinding:
    check_id: str
    severity: Severity
    title: str
    asset_value: str
    description: str = ""
    remediation: str = ""
    evidence: dict[str, Any] = field(default_factory=dict)
    fingerprint: str = ""

    def __post_init__(self):
        if not self.fingerprint:
            raw = f"{self.check_id}|{self.asset_value}|{sorted(self.evidence.items()) if self.evidence else ''}"
            self.fingerprint = hashlib.sha256(raw.encode()).hexdigest()[:32]


@dataclass
class ScanResult:
    assets: list[RawAsset] = field(default_factory=list)
    findings: list[RawFinding] = field(default_factory=list)
    scanner_name: str = ""
    errors: list[str] = field(default_factory=list)


class BaseScanner:
    name: str = "base"

    def run(self, ctx: ScanContext) -> ScanResult:
        raise NotImplementedError
