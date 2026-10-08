"""
seed.py — Database initialisation and seed script for MEDRecords.

Steps performed:
  1. Create the `medrecords` PostgreSQL database if it does not already exist.
  2. Run Alembic migrations programmatically (upgrade to head).
  3. Upsert a default sys_admin user.
  4. Upsert the `lock_window_hours` app_config record.

Usage:
    cd backend
    python seed.py
"""

import asyncio
import subprocess
import sys
import os

# Ensure the backend/ directory is on sys.path so `app.*` imports resolve
sys.path.insert(0, os.path.dirname(__file__))

import asyncpg
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Step 1 – Ensure the database exists
# ---------------------------------------------------------------------------
async def ensure_database_exists() -> None:
    """Connect to the `postgres` maintenance DB and create `medrecords` if absent."""
    print(f"[seed] Checking if database '{settings.db_name}' exists …")

    # Connect to the postgres maintenance database (not the target db)
    conn = await asyncpg.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database="postgres",
    )
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", settings.db_name
        )
        if exists:
            print(f"[seed] Database '{settings.db_name}' already exists — skipping creation.")
        else:
            # CREATE DATABASE cannot run inside a transaction block
            await conn.execute(f'CREATE DATABASE "{settings.db_name}"')
            print(f"[seed] Database '{settings.db_name}' created successfully.")
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# Step 2 – Run Alembic migrations
# ---------------------------------------------------------------------------
def run_migrations() -> None:
    """Invoke `alembic upgrade head` as a subprocess from the backend/ directory."""
    print("[seed] Running Alembic migrations (upgrade head) …")
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"Alembic migration failed with exit code {result.returncode}")
    print("[seed] Migrations applied successfully.")


# ---------------------------------------------------------------------------
# Step 3 & 4 – Seed data
# ---------------------------------------------------------------------------
async def seed_data() -> None:
    """Upsert the sys_admin user and app_config records."""
    engine = create_async_engine(settings.async_database_url, echo=False)
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        async with session.begin():
            # ----------------------------------------------------------------
            # Upsert sys_admin user
            # ----------------------------------------------------------------
            print("[seed] Upserting sys_admin user …")
            hashed_password = pwd_context.hash("Admin@1234")

            await session.execute(
                text(
                    """
                    INSERT INTO users
                        (username, email, full_name, hashed_password, role, is_active, must_change_password)
                    VALUES
                        (:username, :email, :full_name, :hashed_password, :role, TRUE, FALSE)
                    ON CONFLICT (username) DO NOTHING
                    """
                ),
                {
                    "username": "admin",
                    "email": "admin@medrecords.com",
                    "full_name": "System Administrator",
                    "hashed_password": hashed_password,
                    "role": "sys_admin",
                },
            )
            print("[seed] sys_admin user upserted (skipped if already exists).")

            # ----------------------------------------------------------------
            # Upsert demo users for every role
            # ----------------------------------------------------------------
            demo_users = [
                {
                    "username": "dr.smith",
                    "email": "dr.smith@medrecords.com",
                    "full_name": "Dr. Sarah Smith",
                    "hashed_password": pwd_context.hash("Doctor@1234"),
                    "role": "doctor",
                },
                {
                    "username": "adminuser",
                    "email": "adminuser@medrecords.com",
                    "full_name": "Admin User",
                    "hashed_password": pwd_context.hash("Admin@1234"),
                    "role": "admin",
                },
                {
                    "username": "pharmauser",
                    "email": "pharmauser@medrecords.com",
                    "full_name": "Pharma Analyst",
                    "hashed_password": pwd_context.hash("Pharma@1234"),
                    "role": "pharma_viewer",
                },
            ]
            for u in demo_users:
                await session.execute(
                    text(
                        """
                        INSERT INTO users
                            (username, email, full_name, hashed_password, role, is_active, must_change_password)
                        VALUES
                            (:username, :email, :full_name, :hashed_password, :role, TRUE, FALSE)
                        ON CONFLICT (username) DO NOTHING
                        """
                    ),
                    u,
                )
            print("[seed] Demo users upserted.")

            # ----------------------------------------------------------------
            # Upsert app_config: lock_window_hours
            # ----------------------------------------------------------------
            print("[seed] Upserting app_config record …")
            await session.execute(
                text(
                    """
                    INSERT INTO app_config (config_key, config_value)
                    VALUES (:config_key, :config_value)
                    ON CONFLICT (config_key) DO NOTHING
                    """
                ),
                {
                    "config_key": "lock_window_hours",
                    "config_value": "24",
                },
            )
            print("[seed] app_config 'lock_window_hours' upserted (skipped if already exists).")

    await engine.dispose()


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
async def main() -> None:
    await ensure_database_exists()
    run_migrations()
    await seed_data()
    print("[seed] All done — database is ready.")


if __name__ == "__main__":
    asyncio.run(main())
