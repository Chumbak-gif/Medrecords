"""Pydantic BaseSettings for MEDRecords application — all environment config in one place."""

import json
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # ── Database ─────────────────────────────────────────────────────────────
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "medrecords"
    db_user: str = "postgres"
    db_password: str = "root"

    # ── JWT ──────────────────────────────────────────────────────────────────
    secret_key: str = "changeme-super-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Allowed origins via the ALLOWED_ORIGINS env var. Accepts EITHER a JSON
    # array or a comma-separated string, e.g.
    #   ALLOWED_ORIGINS=["http://10.21.191.52:8083"]
    #   ALLOWED_ORIGINS=http://10.21.191.52:8083,http://localhost:5173
    # Stored as a plain string to avoid pydantic-settings' eager JSON parsing of
    # list fields; use the `allowed_origins` property for the parsed list.
    allowed_origins_raw: str = Field(
        default="http://localhost:4200,http://localhost:5173,http://localhost:5174",
        validation_alias="ALLOWED_ORIGINS",
    )

    @property
    def allowed_origins(self) -> list[str]:
        raw = (self.allowed_origins_raw or "").strip()
        if not raw:
            return []
        # JSON array form: ["http://a", "http://b"]
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(o).strip() for o in parsed if str(o).strip()]
            except (ValueError, TypeError):
                pass  # fall through to comma-split
        # Comma-separated form
        return [o.strip() for o in raw.split(",") if o.strip()]

    # ── App ──────────────────────────────────────────────────────────────────
    api_prefix: str = "/api/v1"
    environment: str = "development"
    log_level: str = "INFO"

    # ── Celery / Background processing ───────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def async_database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def sync_database_url(self) -> str:
        """Synchronous URL used by Alembic migrations."""
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    """Cached singleton settings instance."""
    return Settings()
