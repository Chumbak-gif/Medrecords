"""PrescriptionService — consolidated business logic for prescription management."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.medicine import MedicineEntity
from src.domain.entities.prescription_row import PrescriptionRowEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import IAssessmentRepository
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.medicine_repository import IMedicineRepository
from src.domain.repositories.prescription_repository import IPrescriptionRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class PrescriptionRowInput:
    """Single prescription row input."""

    medicine_id: int = 0
    medicine_name: Optional[str] = None
    dosage: str = ""
    frequency: str = ""
    duration: str = ""
    instructions: Optional[str] = None
    sort_order: int = 0


class PrescriptionService:
    """Consolidated service for prescription operations."""

    def __init__(
        self,
        prescription_repo: IPrescriptionRepository,
        assessment_repo: IAssessmentRepository,
        medicine_repo: IMedicineRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._prescription_repo = prescription_repo
        self._assessment_repo = assessment_repo
        self._medicine_repo = medicine_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def list_prescriptions(
        self, *, assessment_id: int, actor: UserEntity
    ) -> list[PrescriptionRowEntity]:
        """Retrieve prescription rows for an assessment.

        Raises:
            ValueError: If assessment not found or actor lacks access.
        """
        assessment = await self._assessment_repo.get_by_id(assessment_id)
        if assessment is None:
            raise ValueError("Assessment not found")

        if not self._access_control.is_privileged(actor):
            if assessment.doctor_id != actor.id:
                raise ValueError("You do not have permission to access this assessment")

        return await self._prescription_repo.list(assessment_id=assessment_id)

    async def create_prescription(
        self,
        *,
        assessment_id: int,
        rows: list[PrescriptionRowInput],
        actor: UserEntity,
    ) -> list[PrescriptionRowEntity]:
        """Upsert the entire prescription grid for an assessment.

        Raises:
            ValueError: If assessment not found, actor lacks access, assessment is locked,
                        or no valid rows provided.
        """
        async with self._uow:
            assessment = await self._assessment_repo.get_by_id(assessment_id)
            if assessment is None:
                raise ValueError("Assessment not found")

            if not self._access_control.is_privileged(actor):
                if assessment.doctor_id != actor.id:
                    raise ValueError("You do not have permission to access this assessment")

            if assessment.status == "locked":
                raise ValueError("Assessment is locked and prescriptions cannot be modified")

            if not rows:
                raise ValueError("At least one prescription row with a medicine_id is required")

            await self._prescription_repo.delete_by_assessment(assessment_id)

            new_rows: list[PrescriptionRowEntity] = []
            for item in rows:
                resolved_medicine_id = item.medicine_id

                if resolved_medicine_id == 0 and item.medicine_name:
                    med_name = item.medicine_name.strip()
                    if med_name:
                        existing_med = await self._medicine_repo.get_by_name(med_name)
                        if existing_med:
                            resolved_medicine_id = existing_med.id
                        else:
                            new_med = MedicineEntity(name=med_name)
                            new_med = await self._medicine_repo.add(new_med)
                            resolved_medicine_id = new_med.id

                if resolved_medicine_id == 0:
                    raise ValueError("Each prescription row must have a valid medicine_id or medicine_name")

                row = PrescriptionRowEntity(
                    assessment_id=assessment_id,
                    medicine_id=resolved_medicine_id,
                    dosage=item.dosage,
                    frequency=item.frequency,
                    duration=item.duration,
                    instructions=item.instructions,
                    sort_order=item.sort_order,
                )
                row = await self._prescription_repo.add(row)
                new_rows.append(row)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="prescription_upserted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="assessment",
                    entity_id=assessment_id,
                    description=(
                        f"Prescription grid upserted for assessment_id={assessment_id}; "
                        f"{len(new_rows)} row(s)"
                    ),
                )
            )
            await self._uow.commit()
            return new_rows
