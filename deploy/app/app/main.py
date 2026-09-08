from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, diseases, patients, templates, followups
from app.routers import assessments
from app.routers import prescriptions, analytics, exports, audit, config_router, users
from app.services.lock_scheduler import start_lock_scheduler, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown hooks."""
    # Startup: launch the assessment lock scheduler
    await start_lock_scheduler(app)
    yield
    # Shutdown: stop the scheduler, then dispose the async engine connection pool
    scheduler.shutdown(wait=False)
    from app.database import engine
    await engine.dispose()


# ---------------------------------------------------------------------------
# FastAPI application instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MEDRecords API",
    description="Doctor-Patient Assessment & Pharma Analytics Portal — Emcure",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router, prefix=settings.api_prefix + "/auth")
app.include_router(diseases.router, prefix=settings.api_prefix + "/diseases")
app.include_router(templates.router, prefix=settings.api_prefix + "/templates")
app.include_router(patients.router, prefix=settings.api_prefix + "/patients")
app.include_router(assessments.router, prefix=settings.api_prefix + "/assessments")
app.include_router(prescriptions.router, prefix=settings.api_prefix + "/prescriptions")
app.include_router(analytics.router, prefix=settings.api_prefix + "/analytics")
app.include_router(exports.router, prefix=settings.api_prefix + "/exports")
app.include_router(audit.router, prefix=settings.api_prefix + "/audit")
app.include_router(config_router.router, prefix=settings.api_prefix + "/config")
app.include_router(users.router, prefix=settings.api_prefix + "/users")
app.include_router(followups.router, prefix=settings.api_prefix + "/followups")


# ---------------------------------------------------------------------------
# Health-check endpoint
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "MEDRecords API"}


# ---------------------------------------------------------------------------
# Entry-point for `python -m app.main` or direct script execution
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
