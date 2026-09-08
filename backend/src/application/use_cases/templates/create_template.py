"""Create Template use case — admin-only, version management, audit log."""

from dataclasses import dataclass
from typing import Any, Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.form_template import FormTemplateEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.disease_repository import DiseaseRepository
from src.domain.repositories.template_repository import TemplateRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class CreateTemplateCommand:
    """Input data for creating a new form template."""

    disease_id: int = 0
    schema: dict[str, Any] = None  # type: ignore[assignment]
    actor: Optional[UserEntity] = None

    def __post_init__(self) -> None:
        if self.schema is None:
            self.schema = {}


class CreateTemplateUseCase:
    """Creates a new form template (version=1) for a disease."""

    def __init__(
        self,
        template_repo: TemplateRepository,
        disease_repo: DiseaseRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._template_repo = template_repo
        self._disease_repo = disease_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def execute(self, command: CreateTemplateCommand) -> FormTemplateEntity:
        """Create a new form template.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the referenced disease does not exist.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            # Verify disease exists
            disease = await self._disease_repo.get_by_id(command.disease_id)
            if disease is None:
                raise NotFoundError(f"Disease id={command.disease_id} not found")

            # Build schema dict with metadata
            schema_dict = dict(command.schema)
            schema_dict["version"] = 1
            schema_dict["disease_id"] = command.disease_id

            template = FormTemplateEntity(
                disease_id=command.disease_id,
                version=1,
                schema=schema_dict,
                is_active=True,
                created_by=command.actor.id,
            )
            template = await self._template_repo.add(template)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="template_created",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="form_template",
                    entity_id=template.id,
                    description=(
                        f"Form template v1 created for disease id={command.disease_id} "
                        f"(template id={template.id})"
                    ),
                )
            )

            await self._uow.commit()
            return template
