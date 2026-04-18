from uuid import UUID
from datetime import datetime, date
from typing import Any
from pydantic import BaseModel


class ReportOut(BaseModel):
    id: UUID
    tenant_id: UUID
    period_start: date
    period_end: date
    file_path: str | None
    summary: dict[str, Any] = {}
    generated_at: datetime

    class Config:
        from_attributes = True
