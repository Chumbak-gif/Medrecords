"""
Patients router
Prefix:  /api/v1/patients  (mounted in main.py)

Access control:
  GET  /           — doctor, admin, sys_admin  (doctor-scoped)
  POST /           — doctor, admin, sys_admin
  GET  /{id}       — doctor, admin, sys_admin  (doctor-scoped)
  PATCH /{id}      — doctor, admin, sys_admin  (doctor-scoped)
  DELETE /{id}     — admin, sys_admin only
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, role_required
from app.models.assessment import Assessment
from app.models.audit_log import AuditLog
from app.models.disease import Disease
from app.models.patient import Patient
from app.models.user import User
from app.schemas.disease import PaginatedResponse
from app.schemas.patient import (
    PatientDetail,
    PatientResponse,
    RegisterPatientDto,
    UpdatePatientDto,
    VisitSummary,
)

router = APIRouter(tags=["Patients"])

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_DOCTOR_ROLES = ["doctor", "admin", "sys_admin"]
_ADMIN_ROLES = ["admin", "sys_admin"]


async def _audit(
    db: AsyncSession,
    *,
    event_type: str,
    actor: User,
    entity_type: str,
    entity_id: int,
    description: str,
) -> None:
    """Append an audit log entry (no commit — caller owns the transaction)."""
    db.add(
        AuditLog(
            event_type=event_type,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_role=actor.role,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )
    )


def _is_admin(user: User) -> bool:
    return user.role in _ADMIN_ROLES


# ---------------------------------------------------------------------------
# GET /  — paginated patient list
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=PaginatedResponse[PatientResponse],
    summary="List patients (paginated + search, doctor-scoped)",
)
async def list_patients(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query("", description="Search term matched against name / contact / uid"),
    current_user: User = Depends(role_required(_DOCTOR_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[PatientResponse]:
    q = select(Patient).where(Patient.is_active.is_(True))

    # All roles (including doctors) can see all active patients
    # No doctor-scoped filtering

    if search:
        like = f"%{search}%"
        q = q.where(
            or_(
                Patient.first_name.ilike(like),
                Patient.last_name.ilike(like),
                Patient.contact_number.ilike(like),
                Patient.patient_uid.ilike(like),
            )
        )

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Paginated rows
    offset = (page - 1) * page_size
    result = await db.execute(
        q.order_by(Patient.created_at.desc()).offset(offset).limit(page_size)
    )
    patients = result.scalars().all()

    return PaginatedResponse(
        items=patients,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# POST /  — register a new patient
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new patient",
)
async def register_patient(
    payload: RegisterPatientDto,
    current_user: User = Depends(role_required(_DOCTOR_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PatientResponse:
    # Duplicate contact_number check
    existing = await db.execute(
        select(Patient).where(Patient.contact_number == payload.contact_number)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A patient with contact number '{payload.contact_number}' already exists",
        )

    # Generate sequential patient_uid (PAT-000001, PAT-000002, …)
    total_result = await db.execute(select(func.count()).select_from(Patient))
    seq: int = total_result.scalar_one() + 1
    patient_uid = f"PAT-{seq:06d}"

    patient = Patient(
        patient_uid=patient_uid,
        first_name=payload.first_name,
        last_name=payload.last_name,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        contact_number=payload.contact_number,
        email=payload.email,
        registered_by=current_user.id,
    )
    db.add(patient)
    await db.flush()  # populate patient.id before the audit entry

    await _audit(
        db,
        event_type="patient_registered",
        actor=current_user,
        entity_type="patient",
        entity_id=patient.id,
        description=(
            f"Patient '{patient.first_name} {patient.last_name}' "
            f"(uid={patient.patient_uid}) registered"
        ),
    )

    return patient


# ---------------------------------------------------------------------------
# GET /{id}  — patient profile + visit history
# ---------------------------------------------------------------------------

@router.get(
    "/{id}",
    response_model=PatientDetail,
    summary="Get patient profile with visit history summary",
)
async def get_patient(
    id: int,
    current_user: User = Depends(role_required(_DOCTOR_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PatientDetail:
    result = await db.execute(select(Patient).where(Patient.id == id))
    patient: Optional[Patient] = result.scalar_one_or_none()
    if patient is None or not patient.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # All authenticated users with the right role can view any patient

    # Visit history: assessments joined with disease for disease_name
    visits_result = await db.execute(
        select(Assessment, Disease.name.label("disease_name"))
        .join(Disease, Assessment.disease_id == Disease.id)
        .where(Assessment.patient_id == id)
        .order_by(Assessment.created_at.desc())
    )
    rows = visits_result.all()

    visits: list[VisitSummary] = [
        VisitSummary(
            assessment_id=row.Assessment.id,
            visit_date=row.Assessment.created_at,
            disease_name=row.disease_name,
            status=row.Assessment.status,
        )
        for row in rows
    ]

    # Build the detail response manually from ORM object
    return PatientDetail(
        id=patient.id,
        patient_uid=patient.patient_uid,
        first_name=patient.first_name,
        last_name=patient.last_name,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        contact_number=patient.contact_number,
        email=patient.email,
        registered_by=patient.registered_by,
        is_active=patient.is_active,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
        visits=visits,
    )


# ---------------------------------------------------------------------------
# PATCH /{id}  — update patient demographics
# ---------------------------------------------------------------------------

@router.patch(
    "/{id}",
    response_model=PatientResponse,
    summary="Update patient demographics (doctor-scoped)",
)
async def update_patient(
    id: int,
    payload: UpdatePatientDto,
    current_user: User = Depends(role_required(_DOCTOR_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PatientResponse:
    result = await db.execute(select(Patient).where(Patient.id == id))
    patient: Optional[Patient] = result.scalar_one_or_none()
    if patient is None or not patient.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Doctor-scoped access check
    if current_user.role == "doctor":
        assessment_exists_result = await db.execute(
            select(func.count())
            .select_from(Assessment)
            .where(
                Assessment.patient_id == id,
                Assessment.doctor_id == current_user.id,
            )
        )
        has_assessment = assessment_exists_result.scalar_one() > 0
        if patient.registered_by != current_user.id and not has_assessment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this patient",
            )

    # Check new contact_number for duplicate (if being changed)
    if (
        payload.contact_number is not None
        and payload.contact_number != patient.contact_number
    ):
        dup = await db.execute(
            select(Patient).where(
                Patient.contact_number == payload.contact_number,
                Patient.id != id,
            )
        )
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A patient with contact number '{payload.contact_number}' already exists",
            )

    # Apply updates for provided fields
    if payload.first_name is not None:
        patient.first_name = payload.first_name
    if payload.last_name is not None:
        patient.last_name = payload.last_name
    if payload.date_of_birth is not None:
        patient.date_of_birth = payload.date_of_birth
    if payload.gender is not None:
        patient.gender = payload.gender
    if payload.contact_number is not None:
        patient.contact_number = payload.contact_number
    if payload.email is not None:
        patient.email = payload.email

    await _audit(
        db,
        event_type="patient_updated",
        actor=current_user,
        entity_type="patient",
        entity_id=patient.id,
        description=(
            f"Patient '{patient.first_name} {patient.last_name}' "
            f"(uid={patient.patient_uid}) demographics updated"
        ),
    )

    return patient


# ---------------------------------------------------------------------------
# DELETE /{id}  — soft-delete (admin/sys_admin only)
# ---------------------------------------------------------------------------

@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a patient (admin/sys_admin only)",
)
async def delete_patient(
    id: int,
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Patient).where(Patient.id == id))
    patient: Optional[Patient] = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if not patient.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Patient is already inactive",
        )

    patient.is_active = False

    await _audit(
        db,
        event_type="patient_deleted",
        actor=current_user,
        entity_type="patient",
        entity_id=patient.id,
        description=(
            f"Patient '{patient.first_name} {patient.last_name}' "
            f"(uid={patient.patient_uid}) soft-deleted"
        ),
    )
