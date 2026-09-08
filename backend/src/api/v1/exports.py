"""Exports router — thin controller delegating to use cases.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from src.api.v1.dependencies.auth import role_required
from src.api.v1.dependencies.container import get_export_data_use_case
from src.application.use_cases.exports.export_data import (
    ExportAssessmentsQuery,
    ExportAuditQuery,
    ExportDataUseCase,
    ExportPdfQuery,
)
from src.domain.entities.user import UserEntity
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Exports"])

_ADMIN_ROLES = ["admin", "sys_admin"]
_ALL_ROLES = ["doctor", "admin", "sys_admin"]


# --- Helpers ---

def _to_actor(user_model: UserModel) -> UserEntity:
    return UserEntity(
        id=user_model.id,
        username=user_model.username,
        email=user_model.email,
        full_name=user_model.full_name,
        hashed_password=user_model.hashed_password,
        role=user_model.role,
        specialty=user_model.specialty,
        is_active=user_model.is_active,
        created_at=user_model.created_at,
        updated_at=user_model.updated_at,
    )


# --- Endpoints ---

@router.get(
    "/assessments/excel",
    summary="Return assessment data for client-side XLSX generation",
)
async def export_assessments_excel(
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (doctor export)"),
    year: Optional[int] = Query(None, ge=2000, description="Year (doctor export)"),
    from_date: Optional[date] = Query(None, description="Admin: start date"),
    to_date: Optional[date] = Query(None, description="Admin: end date"),
    current_user: UserModel = Depends(role_required(_ALL_ROLES)),
    use_case: ExportDataUseCase = Depends(get_export_data_use_case),
):
    query = ExportAssessmentsQuery(
        month=month,
        year=year,
        from_date=from_date,
        to_date=to_date,
        actor=_to_actor(current_user),
    )
    return await use_case.export_assessments(query)


@router.get(
    "/assessments/{id}/pdf-data",
    summary="Return full assessment data as JSON for jspdf generation",
)
async def export_assessment_pdf_data(
    id: int,
    current_user: UserModel = Depends(role_required(_ALL_ROLES)),
    use_case: ExportDataUseCase = Depends(get_export_data_use_case),
):
    query = ExportPdfQuery(
        assessment_id=id,
        actor=_to_actor(current_user),
    )
    return await use_case.export_assessment_pdf(query)


@router.get(
    "/audit/excel",
    summary="Return audit log data for client-side XLSX generation (admin/sys_admin only)",
)
async def export_audit_excel(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    event_type: Optional[str] = Query(None),
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    use_case: ExportDataUseCase = Depends(get_export_data_use_case),
):
    query = ExportAuditQuery(
        from_date=from_date,
        to_date=to_date,
        event_type=event_type,
        actor=_to_actor(current_user),
    )
    return await use_case.export_audit(query)
