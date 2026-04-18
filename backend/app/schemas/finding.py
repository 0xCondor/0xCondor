from uuid import UUID
from datetime import datetime
from typing import Any
from pydantic import BaseModel


class FindingOut(BaseModel):
    id: UUID
    tenant_id: UUID
    check_id: str
    asset_value: str
    severity: str
    status: str
    title: str
    description: str | None
    remediation: str | None
    evidence: dict[str, Any] = {}
    first_seen_at: datetime
    last_seen_at: datetime
    resolved_at: datetime | None
    occurrences: int

    class Config:
        from_attributes = True


class FindingUpdate(BaseModel):
    status: str  # open, acknowledged, resolved, false_positive
