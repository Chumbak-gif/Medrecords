"""PatientService — consolidated business logic for patient management."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.patient import PatientEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import IAssessmentRepository
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.patient_repository import IPatientRepository
from src.domain.services.access_control import AccessControlService
from src.domain.services.patient_uid_generator import PatientUidGenerator


@dataclass
class PaginatedResult:
    """Paginated result container for patients."""

    items: list[PatientEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class PatientService:
    """Consolidated service for patient management operations."""

    def __init__(
        self,
        patient_repo: IPatientRepository,
        assessment_repo: IAssessmentRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uid_generator: PatientUidGenerator,
        uow: UnitOfWork,
    ) -> None:
        self._patient_repo = patient_repo
        self._assessment_repo = assessment_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uid_generator = uid_generator
        self._uow = uow

    async def register_patient(
        self,
        *,
        first_name: str,
        last_name: str,
        date_of_birth: Optional[date],
        gender: str,
        contact_number: str,
        email: Optional[str] = None,
        actor: UserEntity,
    ) -> PatientEntity:
        """Register a new patient.

        Raises:
            ValueError: If a patient with the same contact_number already exists.
        """
        async with self._uow:
            existing = await self._patient_repo.get_by_contact_number(contact_number)
            if existing is not None:
                raise ValueError(f"A patient with contact number '{contact_number}' already exists")

            patient_uid = await self._uid_generator.generate_next()

            patient = PatientEntity(
                patient_uid=str(patient_uid),
                first_name=first_name,
                last_name=last_name,
                date_of_birth=date_of_birth,
                gender=gender,
                contact_number=contact_number,
                email=email,
                registered_by=actor.id,
            )
            patient = await self._patient_repo.add(patient)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="patient_registered",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="patient",
                    entity_id=patient.id,
                    description=(
                        f"Patient '{patient.first_name} {patient.last_name}' "
                        f"(uid={patient.patient_uid}) registered"
                    ),
                )
            )
            await self._uow.commit()
            return patient

    async def list_patients(
        self, *, page: int = 1, page_size: int = 20, search: str = "", actor: UserEntity
    ) -> PaginatedResult:
        """List patients with pagination, search, and doctor-scoping."""
        doctor_id = self._access_control.get_doctor_scope_id(actor)
        offset = (page - 1) * page_size

        patients = await self._patient_repo.list(
            offset=offset, limit=page_size, doctor_id=doctor_id, search=search
        )
        total = await self._patient_repo.count(doctor_id=doctor_id, search=search)
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=patients, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    async def get_patient(self, *, patient_id: int, actor: UserEntity) -> PatientEntity:
        """Retrieve a patient by ID with doctor-scoping access control.

        Raises:
            ValueError: If the patient not found or actor lacks access.
        """
        patient = await self._patient_repo.get_by_id(patient_id)
        if patient is None or not patient.is_active:
            raise ValueError("Patient not found")

        if not self._access_control.is_privileged(actor):
            assessments = await self._assessment_repo.list(
                offset=0, limit=1, patient_id=patient_id, doctor_id=actor.id
            )
            doctor_ids_who_assessed = [actor.id] if assessments else []
            try:
                self._access_control.assert_can_access_patient(
                    user=actor,
                    patient_registered_by=patient.registered_by,
                    doctor_ids_who_assessed=doctor_ids_who_assessed,
                )
            except Exception as e:
                raise ValueError(str(e)) from e

        return patient

    async def update_patient(
        self,
        *,
        patient_id: int,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        date_of_birth: Optional[date] = None,
        gender: Optional[str] = None,
        contact_number: Optional[str] = None,
        email: Optional[str] = None,
        actor: UserEntity,
    ) -> PatientEntity:
        """Update patient demographics with access control.

        Raises:
            ValueError: If patient not found, actor lacks access, or contact conflict.
        """
        async with self._uow:
            patient = await self._patient_repo.get_by_id(patient_id)
            if patient is None or not patient.is_active:
                raise ValueError("Patient not found")

            if not self._access_control.is_privileged(actor):
                assessments = await self._assessment_repo.list(
                    offset=0, limit=1, patient_id=patient_id, doctor_id=actor.id
                )
                doctor_ids_who_assessed = [actor.id] if assessments else []
                try:
                    self._access_control.assert_can_access_patient(
                        user=actor,
                        patient_registered_by=patient.registered_by,
                        doctor_ids_who_assessed=doctor_ids_who_assessed,
                    )
                except Exception as e:
                    raise ValueError(str(e)) from e

            if contact_number is not None and contact_number != patient.contact_number:
                existing = await self._patient_repo.get_by_contact_number(contact_number)
                if existing is not None and existing.id != patient_id:
                    raise ValueError(f"A patient with contact number '{contact_number}' already exists")

            if first_name is not None:
                patient.first_name = first_name
            if last_name is not None:
                patient.last_name = last_name
            if date_of_birth is not None:
                patient.date_of_birth = date_of_birth
            if gender is not None:
                patient.gender = gender
            if contact_number is not None:
                patient.contact_number = contact_number
            if email is not None:
                patient.email = email

            patient = await self._patient_repo.update(patient)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="patient_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="patient",
                    entity_id=patient.id,
                    description=(
                        f"Patient '{patient.first_name} {patient.last_name}' "
                        f"(uid={patient.patient_uid}) demographics updated"
                    ),
                )
            )
            await self._uow.commit()
            return patient

    async def delete_patient(self, *, patient_id: int, actor: UserEntity) -> None:
        """Soft-delete a patient (admin only).

        Raises:
            ValueError: If actor lacks permission, patient not found, or already inactive.
        """
        try:
            self._access_control.assert_can_manage_users(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            patient = await self._patient_repo.get_by_id(patient_id)
            if patient is None:
                raise ValueError("Patient not found")
            if not patient.is_active:
                raise ValueError("Patient is already inactive")

            patient.is_active = False
            await self._patient_repo.update(patient)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="patient_deleted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="patient",
                    entity_id=patient.id,
                    description=(
                        f"Patient '{patient.first_name} {patient.last_name}' "
                        f"(uid={patient.patient_uid}) soft-deleted"
                    ),
                )
            )
            await self._uow.commit()
