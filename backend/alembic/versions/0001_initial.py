"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("price_monthly_eur", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("price_yearly_eur", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_tenants", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_domains", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("scan_frequency_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("white_label_level", sa.String(20), nullable=False, server_default="none"),
        sa.Column("stripe_price_id", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(80), unique=True, nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subscription_plans.id")),
        sa.Column("billing_customer_id", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("primary_color", sa.String(20), server_default="#0F766E"),
        sa.Column("custom_domain", sa.String(200), nullable=True),
        sa.Column("report_footer", sa.String(500), nullable=True),
        sa.Column("settings", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    user_role = postgresql.ENUM("owner", "admin", "operator", "readonly", name="userrole", create_type=True)
    user_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("full_name", sa.String(200), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, server_default="owner"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("mfa_secret", sa.String(100), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("current_score", sa.Integer(), server_default="100"),
        sa.Column("current_grade", sa.String(2), server_default="A"),
        sa.Column("last_scan_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "domains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("fqdn", sa.String(255), nullable=False, index=True),
        sa.Column("is_primary", sa.Boolean(), server_default="false"),
        sa.Column("verification_token", sa.String(100), nullable=False),
        sa.Column("ownership_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ownership_method", sa.String(30), server_default="dns_txt"),
        sa.Column("last_verification_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_scan_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    asset_type = postgresql.ENUM("subdomain", "ip", "port", "service", "http_endpoint", "cert", "email_record", "dns_record", name="assettype", create_type=True)
    asset_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("domains.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("type", asset_type, nullable=False),
        sa.Column("value", sa.String(500), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
    )
    op.create_index("ix_assets_tenant_last_seen", "assets", ["tenant_id", "last_seen_at"])
    op.create_index("ix_assets_tenant_type", "assets", ["tenant_id", "type"])

    scan_status = postgresql.ENUM("queued", "running", "completed", "failed", "cancelled", name="scanstatus", create_type=True)
    scan_status.create(op.get_bind(), checkfirst=True)
    scan_type = postgresql.ENUM("full", "incremental", "manual", name="scantype", create_type=True)
    scan_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("domains.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", scan_type, server_default="full"),
        sa.Column("status", scan_status, server_default="queued"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triggered_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("stats", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    severity_enum = postgresql.ENUM("info", "low", "medium", "high", "critical", name="severity", create_type=True)
    severity_enum.create(op.get_bind(), checkfirst=True)
    finding_status = postgresql.ENUM("open", "acknowledged", "resolved", "false_positive", name="findingstatus", create_type=True)
    finding_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("check_id", sa.String(100), nullable=False),
        sa.Column("asset_value", sa.String(500), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False, server_default=""),
        sa.Column("severity", severity_enum, nullable=False),
        sa.Column("status", finding_status, server_default="open"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("remediation", sa.Text(), nullable=True),
        sa.Column("evidence", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("occurrences", sa.Integer(), server_default="1"),
    )
    op.create_index("ix_findings_tenant_severity_status", "findings", ["tenant_id", "severity", "status"])
    op.create_index("ix_findings_fingerprint", "findings", ["tenant_id", "check_id", "asset_value", "fingerprint"])

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("summary", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("generated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), index=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("channel", sa.String(20), server_default="email"),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), index=True),
    )

    # Block UPDATE/DELETE on audit_logs
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs is append-only';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
    """)
    op.execute("""
        CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
    """)

    op.create_table(
        "score_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), index=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False, index=True),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("grade", sa.String(2), nullable=False),
        sa.Column("breakdown", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("score_history")
    op.execute("DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_mutation")
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("reports")
    op.drop_table("findings")
    op.drop_table("scans")
    op.drop_table("assets")
    op.drop_table("domains")
    op.drop_table("tenants")
    op.drop_table("users")
    op.drop_table("organizations")
    op.drop_table("subscription_plans")
    for e in ["findingstatus", "severity", "scantype", "scanstatus", "assettype", "userrole"]:
        op.execute(f"DROP TYPE IF EXISTS {e}")
