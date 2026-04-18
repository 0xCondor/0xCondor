import uuid
import enum
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Enum, Text, Index, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Severity(str, enum.Enum):
    info = "info"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class FindingStatus(str, enum.Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"
    false_positive = "false_positive"


SEVERITY_WEIGHT = {
    Severity.info: 0,
    Severity.low: 1,
    Severity.medium: 3,
    Severity.high: 10,
    Severity.critical: 25,
}


class Finding(Base):
    __tablename__ = "findings"
    __table_args__ = (
        Index("ix_findings_tenant_severity_status", "tenant_id", "severity", "status"),
        Index("ix_findings_fingerprint", "tenant_id", "check_id", "asset_value", "fingerprint"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    scan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="SET NULL"), nullable=True)

    check_id: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_value: Mapped[str] = mapped_column(String(500), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, default="")

    severity: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False)
    status: Mapped[FindingStatus] = mapped_column(Enum(FindingStatus), default=FindingStatus.open)

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    remediation: Mapped[str] = mapped_column(Text, nullable=True)
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict)

    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    occurrences: Mapped[int] = mapped_column(Integer, default=1)
