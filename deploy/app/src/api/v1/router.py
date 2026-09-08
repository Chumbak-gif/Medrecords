"""Aggregates all v1 sub-routers under prefix /api/v1."""

from fastapi import APIRouter

from src.api.v1 import (
    analytics,
    assessments,
    audit,
    auth,
    config_router,
    diseases,
    exports,
    followups,
    medicines,
    patients,
    prescriptions,
    templates,
    users,
)

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth.router, prefix="/auth")
v1_router.include_router(diseases.router, prefix="/diseases")
v1_router.include_router(templates.router, prefix="/templates")
v1_router.include_router(patients.router, prefix="/patients")
v1_router.include_router(assessments.router, prefix="/assessments")
v1_router.include_router(prescriptions.router, prefix="/prescriptions")
v1_router.include_router(analytics.router, prefix="/analytics")
v1_router.include_router(exports.router, prefix="/exports")
v1_router.include_router(audit.router, prefix="/audit")
v1_router.include_router(config_router.router, prefix="/config")
v1_router.include_router(users.router, prefix="/users")
v1_router.include_router(followups.router, prefix="/followups")
v1_router.include_router(medicines.router, prefix="/medicines")
