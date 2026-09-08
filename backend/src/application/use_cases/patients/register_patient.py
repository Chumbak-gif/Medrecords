"""Register Patient use case — validate unique contact, generate UID, create patient, audit log."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.patient import PatientEntity
from src.domain.exceptions import ConflictError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.patient_repository import PatientRepository
from src.domain.services.patient_uid_generator import PatientUidGenerator


@dataclass
class RegisterPatientCommand:
    """Input data for registering a new patient."""

    first_name: str
    last_name: str
    date_of_birth: Optional[date]
    gender: str
    contact_number: str
    email: Optional[str] = None
    actor_id: int = 0
    actor_username: str = ""
    actor_role: str = ""


class RegisterPatientUseCase:
    """Orchestrates patient registration with uniqueness check and UID generation."""

    def __init__(
        self,
        patient_repo: PatientRepository,
        audit_repo: AuditLogRepository,
        uid_generator: PatientUidGenerator,
        uow: UnitOfWork,
    ) -> None:
        self._patient_repo = patient_repo
        self._audit_repo = audit_repo
        self._uid_generator = uid_generator
        self._uow = uow

    async def execute(self, command: RegisterPatientCommand) -> PatientEntity:
        """Register a new patient.

        Raises:
            ConflictError: If a patient with the same contact_number already exists.
        """
        async with self._uow:
            # Check unique contact number
            existing = await self._patient_repo.get_by_contact_number(command.contact_number)
            if existing is not None:
                raise ConflictError(
                    f"A patient with contact number '{command.contact_number}' already exists"
                )

            # Generate sequential UID (PAT-XXXXXX)
            patient_uid = await self._uid_generator.generate_next()

            patient = PatientEntity(
                patient_uid=str(patient_uid),
                first_name=command.first_name,
                last_name=command.last_name,
                date_of_birth=command.date_of_birth,
                gender=command.gender,
                contact_number=command.contact_number,
                email=command.email,
                registered_by=command.actor_id,
            )
            patient = await self._patient_repo.add(patient)

            # Write audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="patient_registered",
                    actor_id=command.actor_id,
                    actor_username=command.actor_username,
                    actor_role=command.actor_role,
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
