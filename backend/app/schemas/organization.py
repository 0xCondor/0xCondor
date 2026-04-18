from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: str
    logo_url: str | None
    primary_color: str | None
    custom_domain: str | None
    report_footer: str | None
    plan_code: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class BrandingUpdate(BaseModel):
    logo_url: str | None = None
    primary_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    custom_domain: str | None = None
    report_footer: str | None = None
