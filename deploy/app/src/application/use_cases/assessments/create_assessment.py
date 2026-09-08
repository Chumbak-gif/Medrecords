"""Create Assessment use case — create with template snapshot, consent, audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.assessment import AssessmentEntity
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.template_repository import TemplateRepository


@dataclass
class CreateAssessmentCommand:
    """Input data for creating a new assessment."""

    patient_id: int = 0
    disease_id: int = 0
    sub_disease_id: Optional[int] = None
    template_id: int = 0
    actor: Optional[UserEntity] = None


class CreateAssessmentUseCase:
    """Creates a new assessment in draft state with a template snapshot."""

    def __init__(
        self,
        assessment_repo: AssessmentRepository,
        template_repo: TemplateRepository,
        audit_repo: AuditLogRepository,
        uow: UnitOfWork,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._template_repo = template_repo
        self._audit_repo = audit_repo
        self._uow = uow

    async def execute(self, command: CreateAssessmentCommand) -> AssessmentEntity:
        """Create a new draft assessment.

        Raises:
            NotFoundError: If the template_id does not reference an active template.
        """
        async with self._uow:
            # Load and validate template
            template = await self._template_repo.get_by_id(command.template_id)
            if template is None or not template.is_active:
                raise NotFoundError(
                    f"Active form template with id={command.template_id} not found"
                )

            # Create assessment with snapshotted template schema
            assessment = AssessmentEntity(
                patient_id=command.patient_id,
                disease_id=command.disease_id,
                sub_disease_id=command.sub_disease_id,
                template_id=command.template_id,
                template_snapshot=dict(template.schema),
                form_data={},
                status="draft",
                consent_given=False,
                doctor_id=command.actor.id,
            )
            assessment = await self._assessment_repo.add(assessment)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="assessment_created",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="assessment",
                    entity_id=assessment.id,
                    description=(
                        f"Assessment created for patient_id={command.patient_id}, "
                        f"disease_id={command.disease_id}, template_id={command.template_id}"
                    ),
                )
            )

            await self._uow.commit()
            return assessment
