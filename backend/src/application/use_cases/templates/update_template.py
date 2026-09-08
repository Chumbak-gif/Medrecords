"""Update Template use case — version a template (deactivate old, create new version)."""

from dataclasses import dataclass
from typing import Any, Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.form_template import FormTemplateEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.template_repository import TemplateRepository


@dataclass
class UpdateTemplateCommand:
    """Input data for updating (versioning) a form template."""

    template_id: int = 0
    schema: dict[str, Any] = None  # type: ignore[assignment]
    actor: Optional[UserEntity] = None

    def __post_init__(self) -> None:
        if self.schema is None:
            self.schema = {}


class UpdateTemplateUseCase:
    """Creates a new version of a template, deactivating the old one."""

    def __init__(
        self,
        template_repo: TemplateRepository,
        audit_repo: AuditLogRepository,
        uow: UnitOfWork,
    ) -> None:
        self._template_repo = template_repo
        self._audit_repo = audit_repo
        self._uow = uow

    async def execute(self, command: UpdateTemplateCommand) -> FormTemplateEntity:
        """Update a template by creating a new version.

        Raises:
            NotFoundError: If the template does not exist.
        """
        async with self._uow:
            old_template = await self._template_repo.get_by_id(command.template_id)
            if old_template is None:
                raise NotFoundError("Form template not found")

            disease_id = old_template.disease_id
            new_version = old_template.version + 1

            # Deactivate all active templates for this disease
            await self._template_repo.deactivate_for_disease(disease_id)

            # Build schema dict with metadata
            schema_dict = dict(command.schema)
            schema_dict["version"] = new_version
            schema_dict["disease_id"] = disease_id

            new_template = FormTemplateEntity(
                disease_id=disease_id,
                version=new_version,
                schema=schema_dict,
                is_active=True,
                created_by=command.actor.id,
            )
            new_template = await self._template_repo.add(new_template)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="template_updated",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="form_template",
                    entity_id=new_template.id,
                    description=(
                        f"Form template for disease id={disease_id} updated: "
                        f"v{old_template.version} (id={old_template.id}) deactivated, "
                        f"v{new_version} (id={new_template.id}) created"
                    ),
                )
            )

            await self._uow.commit()
            return new_template
