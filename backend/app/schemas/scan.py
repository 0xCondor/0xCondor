from uuid import UUID
from datetime import datetime
from typing import Any
from pydantic import BaseModel


class ScanCreate(BaseModel):
    domain_id: UUID


class ScanOut(BaseModel):
    id: UUID
    tenant_id: UUID
    domain_id: UUID | None
    type: str
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    stats: dict[str, Any] = {}
    error_message: str | None
    created_at: datetime

    class Config:
        from_attributes = True
