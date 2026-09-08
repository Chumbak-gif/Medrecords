"""Update Patient use case — update fields, audit log."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.patient import PatientEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, ForbiddenError, NotFoundError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.patient_repository import PatientRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class UpdatePatientCommand:
    """Input data for updating a patient's demographics."""

    patient_id: int = 0
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    actor: Optional[UserEntity] = None


class UpdatePatientUseCase:
    """Updates patient demographics with access control and audit logging."""

    def __init__(
        self,
        patient_repo: PatientRepository,
        assessment_repo: AssessmentRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._patient_repo = patient_repo
        self._assessment_repo = assessment_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def execute(self, command: UpdatePatientCommand) -> PatientEntity:
        """Update patient fields with access control.

        Raises:
            NotFoundError: If the patient does not exist or is inactive.
            ForbiddenError: If the actor lacks access to this patient.
            ConflictError: If the new contact_number is already taken.
        """
        async with self._uow:
            patient = await self._patient_repo.get_by_id(command.patient_id)
            if patient is None or not patient.is_active:
                raise NotFoundError("Patient not found")

            # Doctor-scoped access check
            if not self._access_control.is_privileged(command.actor):
                assessments = await self._assessment_repo.list(
                    offset=0,
                    limit=1,
                    patient_id=command.patient_id,
                    doctor_id=command.actor.id,
                )
                doctor_ids_who_assessed = [command.actor.id] if assessments else []

                self._access_control.assert_can_access_patient(
                    user=command.actor,
                    patient_registered_by=patient.registered_by,
                    doctor_ids_who_assessed=doctor_ids_who_assessed,
                )

            # Check contact_number uniqueness if being changed
            if (
                command.contact_number is not None
                and command.contact_number != patient.contact_number
            ):
                existing = await self._patient_repo.get_by_contact_number(command.contact_number)
                if existing is not None and existing.id != command.patient_id:
                    raise ConflictError(
                        f"A patient with contact number '{command.contact_number}' already exists"
                    )

            # Apply field updates
            if command.first_name is not None:
                patient.first_name = command.first_name
            if command.last_name is not None:
                patient.last_name = command.last_name
            if command.date_of_birth is not None:
                patient.date_of_birth = command.date_of_birth
            if command.gender is not None:
                patient.gender = command.gender
            if command.contact_number is not None:
                patient.contact_number = command.contact_number
            if command.email is not None:
                patient.email = command.email

            patient = await self._patient_repo.update(patient)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="patient_updated",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
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
