"""Prescriptions router — preserves all existing endpoint behavior."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.dependencies.auth import role_required
from src.api.v1.dependencies.container import get_db
from src.api.v1.schemas.assessment import PrescriptionRowResponse
from src.infrastructure.persistence.models.assessment_model import AssessmentModel
from src.infrastructure.persistence.models.audit_log_model import AuditLogModel
from src.infrastructure.persistence.models.medicine_model import MedicineModel
from src.infrastructure.persistence.models.prescription_row_model import PrescriptionRowModel
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Prescriptions"])

_READ_ROLES = ["doctor", "admin", "sys_admin", "pharma_viewer"]
_WRITE_ROLES = ["doctor"]


class PrescriptionRowCreate(BaseModel):
    medicine_id: int = 0
    medicine_name: Optional[str] = None
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None
    sort_order: int = 0


async def _audit(
    db: AsyncSession,
    *,
    event_type: str,
    actor: UserModel,
    entity_type: str,
    entity_id: int,
    description: str,
) -> None:
    db.add(
        AuditLogModel(
            event_type=event_type,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_role=actor.role,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )
    )


async def _get_assessment_or_404(
    assessment_id: int,
    current_user: UserModel,
    db: AsyncSession,
) -> AssessmentModel:
    result = await db.execute(
        select(AssessmentModel).where(AssessmentModel.id == assessment_id)
    )
    assessment: Optional[AssessmentModel] = result.scalar_one_or_none()

    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if current_user.role == "doctor" and assessment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this assessment",
        )

    return assessment


@router.get(
    "/assessment/{aid}",
    response_model=list[PrescriptionRowResponse],
    summary="List prescription rows for an assessment",
)
async def get_prescription_rows(
    aid: int,
    current_user: UserModel = Depends(role_required(_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[PrescriptionRowResponse]:
    await _get_assessment_or_404(aid, current_user, db)

    result = await db.execute(
        select(PrescriptionRowModel)
        .where(PrescriptionRowModel.assessment_id == aid)
        .order_by(PrescriptionRowModel.sort_order)
    )
    rows = result.scalars().all()
    return list(rows)


@router.post(
    "/assessment/{aid}",
    response_model=list[PrescriptionRowResponse],
    summary="Upsert prescription grid for an assessment (doctor only, assessment must not be locked)",
)
async def upsert_prescription_rows(
    aid: int,
    payload: list[PrescriptionRowCreate],
    current_user: UserModel = Depends(role_required(_WRITE_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[PrescriptionRowResponse]:
    assessment = await _get_assessment_or_404(aid, current_user, db)

    if assessment.status == "locked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assessment is locked and prescriptions cannot be modified",
        )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one prescription row with a medicine_id is required",
        )

    existing_result = await db.execute(
        select(PrescriptionRowModel).where(PrescriptionRowModel.assessment_id == aid)
    )
    for row in existing_result.scalars().all():
        await db.delete(row)

    new_rows: list[PrescriptionRowModel] = []
    for item in payload:
        resolved_medicine_id = item.medicine_id
        if resolved_medicine_id == 0 and item.medicine_name:
            med_name = item.medicine_name.strip()
            if med_name:
                result_med = await db.execute(
                    select(MedicineModel).where(MedicineModel.name == med_name)
                )
                existing_med = result_med.scalar_one_or_none()
                if existing_med:
                    resolved_medicine_id = existing_med.id
                else:
                    new_med = MedicineModel(name=med_name)
                    db.add(new_med)
                    await db.flush()
                    resolved_medicine_id = new_med.id

        if resolved_medicine_id == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Each prescription row must have a valid medicine_id or medicine_name",
            )

        row = PrescriptionRowModel(
            assessment_id=aid,
            medicine_id=resolved_medicine_id,
            dosage=item.dosage,
            frequency=item.frequency,
            duration=item.duration,
            instructions=item.instructions,
            sort_order=item.sort_order,
        )
        db.add(row)
        new_rows.append(row)

    await db.flush()

    await _audit(
        db,
        event_type="prescription_upserted",
        actor=current_user,
        entity_type="assessment",
        entity_id=aid,
        description=(
            f"Prescription grid upserted for assessment_id={aid}; "
            f"{len(new_rows)} row(s)"
        ),
    )

    return new_rows
