import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Domain(Base):
    __tablename__ = "domains"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    fqdn: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    # Ownership verification
    verification_token: Mapped[str] = mapped_column(String(100), nullable=False)
    ownership_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    ownership_method: Mapped[str] = mapped_column(String(30), default="dns_txt")
    last_verification_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    last_scan_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    tenant: Mapped["Tenant"] = relationship(back_populates="domains")  # type: ignore  # noqa
