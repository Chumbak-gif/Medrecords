"""
Exports router
Prefix:  /api/v1/exports  (mounted in main.py)

Returns raw JSON data payloads for client-side XLSX/PDF generation.

Access control:
  GET /assessments/excel        — doctor (monthly), admin/sys_admin (date range)
  GET /assessments/{id}/pdf-data — doctor (own), admin/sys_admin (any)
  GET /audit/excel              — admin, sys_admin
"""

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user, role_required
from app.models.assessment import Assessment
from app.models.audit_log import AuditLog
from app.models.disease import Disease
from app.models.medicine import Medicine
from app.models.patient import Patient
from app.models.prescription_row import PrescriptionRow
from app.models.user import User

router = APIRouter(tags=["Exports"])

_ADMIN_ROLES = ["admin", "sys_admin"]
_ALL_ROLES = ["doctor", "admin", "sys_admin"]


# ---------------------------------------------------------------------------
# GET /assessments/excel  — assessment data for XLSX
# ---------------------------------------------------------------------------

@router.get(
    "/assessments/excel",
    summary="Return assessment data for client-side XLSX generation",
)
async def export_assessments_excel(
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (doctor export)"),
    year: Optional[int] = Query(None, ge=2000, description="Year (doctor export)"),
    from_date: Optional[date] = Query(None, description="Admin: start date"),
    to_date: Optional[date] = Query(None, description="Admin: end date"),
    current_user: User = Depends(role_required(_ALL_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Assessment, Patient, Disease)
        .join(Patient, Assessment.patient_id == Patient.id)
        .join(Disease, Assessment.disease_id == Disease.id)
    )

    if current_user.role == "doctor":
        q = q.where(Assessment.doctor_id == current_user.id)
        if month is not None and year is not None:
            start_dt = datetime(year, month, 1, tzinfo=timezone.utc)
            # Compute end of month
            if month == 12:
                end_dt = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_dt = datetime(year, month + 1, 1, tzinfo=timezone.utc)
            q = q.where(Assessment.created_at >= start_dt, Assessment.created_at < end_dt)
    else:
        if from_date is not None:
            q = q.where(
                Assessment.created_at >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
            )
        if to_date is not None:
            q = q.where(
                Assessment.created_at <= datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            )

    q = q.order_by(Assessment.created_at.desc())
    result = await db.execute(q)
    rows = result.all()

    data = []
    for row in rows:
        a: Assessment = row.Assessment
        p: Patient = row.Patient
        d: Disease = row.Disease
        data.append(
            {
                "assessment_id": a.id,
                "status": a.status,
                "created_at": a.created_at.isoformat(),
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
                "disease_name": d.name,
                "patient_uid": p.patient_uid,
                "patient_name": f"{p.first_name} {p.last_name}",
                "contact_number": p.contact_number,
                "gender": p.gender,
                "date_of_birth": p.date_of_birth.isoformat(),
                "form_data": a.form_data,
            }
        )

    return data


# ---------------------------------------------------------------------------
# GET /assessments/{id}/pdf-data  — full assessment data for jspdf
# ---------------------------------------------------------------------------

@router.get(
    "/assessments/{id}/pdf-data",
    summary="Return full assessment data as JSON for jspdf generation",
)
async def export_assessment_pdf_data(
    id: int,
    current_user: User = Depends(role_required(_ALL_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Assessment)
        .options(selectinload(Assessment.prescription_rows).selectinload(PrescriptionRow.medicine))
        .where(Assessment.id == id)
    )
    assessment: Optional[Assessment] = result.scalar_one_or_none()

    if assessment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    if current_user.role == "doctor" and assessment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this assessment",
        )

    # Load patient
    patient_result = await db.execute(
        select(Patient).where(Patient.id == assessment.patient_id)
    )
    patient: Patient = patient_result.scalar_one()

    # Load disease
    disease_result = await db.execute(
        select(Disease).where(Disease.id == assessment.disease_id)
    )
    disease: Disease = disease_result.scalar_one()

    prescription_rows = [
        {
            "id": r.id,
            "medicine_id": r.medicine_id,
            "medicine_name": r.medicine.name if r.medicine else f"Medicine #{r.medicine_id}",
            "dosage": r.dosage,
            "frequency": r.frequency,
            "duration": r.duration,
            "instructions": r.instructions or "",
            "sort_order": r.sort_order,
        }
        for r in sorted(assessment.prescription_rows, key=lambda x: x.sort_order)
    ]

    return {
        "assessment": {
            "id": assessment.id,
            "status": assessment.status,
            "form_data": assessment.form_data,
            "template_snapshot": assessment.template_snapshot,
            "consent_given": assessment.consent_given,
            "created_at": assessment.created_at.isoformat(),
            "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
            "locked_at": assessment.locked_at.isoformat() if assessment.locked_at else None,
        },
        "patient": {
            "id": patient.id,
            "patient_uid": patient.patient_uid,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "date_of_birth": patient.date_of_birth.isoformat(),
            "gender": patient.gender,
            "contact_number": patient.contact_number,
            "email": patient.email,
        },
        "disease": {
            "id": disease.id,
            "name": disease.name,
        },
        "prescription_rows": prescription_rows,
    }


# ---------------------------------------------------------------------------
# GET /audit/excel  — audit log data for XLSX
# ---------------------------------------------------------------------------

@router.get(
    "/audit/excel",
    summary="Return audit log data for client-side XLSX generation (admin/sys_admin only)",
)
async def export_audit_excel(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    event_type: Optional[str] = Query(None),
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc())

    if from_date is not None:
        q = q.where(AuditLog.created_at >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc))
    if to_date is not None:
        q = q.where(AuditLog.created_at <= datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc))
    if event_type:
        q = q.where(AuditLog.event_type == event_type)

    result = await db.execute(q)
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "event_type": log.event_type,
            "actor_username": log.actor_username,
            "actor_role": log.actor_role,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
