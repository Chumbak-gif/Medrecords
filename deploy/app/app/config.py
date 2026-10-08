from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database connection
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "medrecords"
    db_user: str = "postgres"
    db_password: str = "root"

    # JWT
    secret_key: str = "changeme-super-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # CORS
    allowed_origins: list[str] = ["http://localhost:4200", "http://localhost:5173", "http://localhost:5174"]

    # App
    api_prefix: str = "/api/v1"
    environment: str = "development"

    # Seed script credentials (seed.py) — override via .env or real
    # environment variables outside local dev. Fixed defaults below are for
    # local development convenience only.
    seed_admin_password: str = "Admin@1234"
    seed_doctor_password: str = "Doctor@1234"
    seed_adminuser_password: str = "Admin@1234"
    seed_pharma_password: str = "Pharma@1234"

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


settings = Settings()
