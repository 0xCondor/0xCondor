from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Condor EASM"
    app_env: str = "development"
    app_secret_key: str = Field(default="change-me")
    app_base_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"

    database_url: str = "postgresql+psycopg://condor:condor_dev_password@postgres:5432/condor"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60
    jwt_refresh_token_days: int = 14

    scan_rate_limit_per_domain: int = 5
    scan_max_subdomains: int = 500
    scan_http_timeout_seconds: int = 8
    scan_user_agent: str = "CondorEASM/1.0"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_solo: str = ""
    stripe_price_msp: str = ""
    stripe_price_msp_pro: str = ""

    reports_dir: str = "storage/reports"


@lru_cache
def get_settings() -> Settings:
    return Settings()
