"""FastAPI application factory for the new clean-architecture src/ layout.

Preserves the same app title, CORS settings, health endpoint, and lock scheduler
as the original app/main.py.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.middleware.correlation_id import CorrelationIdMiddleware
from src.api.middleware.exception_handler import domain_exception_handler
from src.api.v1.router import v1_router
from src.config.settings import get_settings
from src.domain.exceptions import DomainError

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown hooks."""
    # Start the assessment lock scheduler (APScheduler)
    from app.services.lock_scheduler import start_lock_scheduler, scheduler

    await start_lock_scheduler(app)
    yield
    # Shutdown: stop the scheduler, then dispose the async engine connection pool
    scheduler.shutdown(wait=False)
    from src.infrastructure.persistence.database import engine

    await engine.dispose()


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="MEDRecords API",
        description="Doctor-Patient Assessment & Pharma Analytics Portal — Emcure",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS middleware ─────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Correlation ID middleware ───────────────────────────────────────────
    app.add_middleware(CorrelationIdMiddleware)

    # ── Domain exception handlers ──────────────────────────────────────────
    app.add_exception_handler(DomainError, domain_exception_handler)

    # ── API v1 router ──────────────────────────────────────────────────────
    app.include_router(v1_router)

    # ── Health endpoint ────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "ok", "service": "MEDRecords API"}

    return app


# Module-level app instance for uvicorn
app = create_app()
