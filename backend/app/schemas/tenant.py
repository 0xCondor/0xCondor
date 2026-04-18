from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    contact_email: str | None = None


class TenantOut(BaseModel):
    id: UUID
    name: str
    contact_email: str | None
    current_score: int
    current_grade: str
    last_scan_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class TenantListItem(BaseModel):
    id: UUID
    name: str
    current_score: int
    current_grade: str
    last_scan_at: datetime | None
    findings_open: int = 0
    findings_critical: int = 0
    findings_high: int = 0
    delta_7d: int = 0
