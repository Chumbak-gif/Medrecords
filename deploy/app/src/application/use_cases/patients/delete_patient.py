"""Delete Patient use case — soft-delete with audit log (admin only)."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.patient_repository import PatientRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class DeletePatientCommand:
    """Input for soft-deleting a patient."""

    patient_id: int = 0
    actor: Optional[UserEntity] = None


class DeletePatientUseCase:
    """Soft-deletes a patient (sets is_active=False) with admin-only access."""

    def __init__(
        self,
        patient_repo: PatientRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._patient_repo = patient_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def execute(self, command: DeletePatientCommand) -> None:
        """Soft-delete a patient.

        Raises:
            NotFoundError: If the patient does not exist.
            ConflictError: If the patient is already inactive.
            ForbiddenError: If the actor is not admin/sys_admin.
        """
        # Only admins can delete patients
        self._access_control.assert_can_manage_users(command.actor)

        async with self._uow:
            patient = await self._patient_repo.get_by_id(command.patient_id)
            if patient is None:
                raise NotFoundError("Patient not found")

            if not patient.is_active:
                raise ConflictError("Patient is already inactive")

            patient.is_active = False
            await self._patient_repo.update(patient)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="patient_deleted",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="patient",
                    entity_id=patient.id,
                    description=(
                        f"Patient '{patient.first_name} {patient.last_name}' "
                        f"(uid={patient.patient_uid}) soft-deleted"
                    ),
                )
            )

            await self._uow.commit()
