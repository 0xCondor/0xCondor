from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
import re


FQDN_RE = re.compile(r"^(?=.{1,253}$)((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$")


class DomainCreate(BaseModel):
    fqdn: str = Field(min_length=3, max_length=253)
    is_primary: bool = False

    def validate_fqdn(self) -> str:
        fqdn = self.fqdn.lower().strip().rstrip(".")
        if not FQDN_RE.match(fqdn):
            raise ValueError("invalid FQDN")
        return fqdn


class DomainOut(BaseModel):
    id: UUID
    tenant_id: UUID
    fqdn: str
    is_primary: bool
    verification_token: str
    ownership_verified_at: datetime | None
    last_scan_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class DomainVerify(BaseModel):
    verified: bool
    instructions: str | None = None
