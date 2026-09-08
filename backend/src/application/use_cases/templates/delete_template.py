"""Delete Template use case — soft-delete (deactivate) a form template."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.template_repository import TemplateRepository


@dataclass
class DeleteTemplateCommand:
    """Input data for soft-deleting a form template."""

    template_id: int = 0
    actor: Optional[UserEntity] = None


class DeleteTemplateUseCase:
    """Soft-deletes a form template by deactivating it."""

    def __init__(
        self,
        template_repo: TemplateRepository,
        audit_repo: AuditLogRepository,
        uow: UnitOfWork,
    ) -> None:
        self._template_repo = template_repo
        self._audit_repo = audit_repo
        self._uow = uow

    async def execute(self, command: DeleteTemplateCommand) -> None:
        """Soft-delete a template.

        Raises:
            NotFoundError: If the template does not exist.
        """
        async with self._uow:
            template = await self._template_repo.get_by_id(command.template_id)
            if template is None:
                raise NotFoundError("Form template not found")

            template.is_active = False
            await self._template_repo.update(template)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="template_deleted",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="form_template",
                    entity_id=template.id,
                    description=(
                        f"Form template id={template.id} v{template.version} "
                        f"(disease id={template.disease_id}) soft-deleted"
                    ),
                )
            )

            await self._uow.commit()
