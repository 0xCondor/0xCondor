import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_monthly_eur: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    price_yearly_eur: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_tenants: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    max_domains: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    scan_frequency_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    white_label_level: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    stripe_price_id: Mapped[str] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=True)
    billing_customer_id: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")

    # branding (white label)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#0F766E")
    custom_domain: Mapped[str] = mapped_column(String(200), nullable=True)
    report_footer: Mapped[str] = mapped_column(String(500), nullable=True)

    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="organization", cascade="all, delete-orphan")  # type: ignore  # noqa
    tenants: Mapped[list["Tenant"]] = relationship(back_populates="organization", cascade="all, delete-orphan")  # type: ignore  # noqa
    plan: Mapped["SubscriptionPlan"] = relationship()
