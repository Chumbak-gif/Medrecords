"""TemplateService — consolidated business logic for form template management."""

from dataclasses import dataclass
from typing import Any, Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.form_template import FormTemplateEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.disease_repository import IDiseaseRepository
from src.domain.repositories.template_repository import ITemplateRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class PaginatedResult:
    """Paginated result container for templates."""

    items: list[FormTemplateEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class TemplateService:
    """Consolidated service for form template operations."""

    def __init__(
        self,
        template_repo: ITemplateRepository,
        disease_repo: IDiseaseRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._template_repo = template_repo
        self._disease_repo = disease_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def list_templates(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        disease_id: Optional[int] = None,
        include_inactive: bool = False,
    ) -> PaginatedResult:
        """List form templates with pagination."""
        is_active = None if include_inactive else True
        offset = (page - 1) * page_size

        templates = await self._template_repo.list(
            offset=offset, limit=page_size, disease_id=disease_id, is_active=is_active
        )
        total = await self._template_repo.count(disease_id=disease_id, is_active=is_active)
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=templates, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    async def get_template(self, *, template_id: int) -> FormTemplateEntity:
        """Retrieve a template by ID.

        Raises:
            ValueError: If the template does not exist.
        """
        template = await self._template_repo.get_by_id(template_id)
        if template is None:
            raise ValueError("Form template not found")
        return template

    async def get_active_for_disease(self, *, disease_id: int) -> FormTemplateEntity:
        """Retrieve the active template for a disease.

        Raises:
            ValueError: If no active template exists for the disease.
        """
        template = await self._template_repo.get_active_for_disease(disease_id)
        if template is None:
            raise ValueError(f"No active template found for disease id={disease_id}")
        return template

    async def create_template(
        self, *, disease_id: int, schema: dict[str, Any], actor: UserEntity
    ) -> FormTemplateEntity:
        """Create a new form template (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission or disease not found.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            disease = await self._disease_repo.get_by_id(disease_id)
            if disease is None:
                raise ValueError(f"Disease id={disease_id} not found")

            schema_dict = dict(schema)
            schema_dict["version"] = 1
            schema_dict["disease_id"] = disease_id

            template = FormTemplateEntity(
                disease_id=disease_id,
                version=1,
                schema=schema_dict,
                is_active=True,
                created_by=actor.id,
            )
            template = await self._template_repo.add(template)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="template_created",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="form_template",
                    entity_id=template.id,
                    description=(
                        f"Form template v1 created for disease id={disease_id} "
                        f"(template id={template.id})"
                    ),
                )
            )
            await self._uow.commit()
            return template

    async def update_template(
        self, *, template_id: int, schema: dict[str, Any], actor: UserEntity
    ) -> FormTemplateEntity:
        """Create a new version of a template, deactivating the old one.

        Raises:
            ValueError: If template not found.
        """
        async with self._uow:
            old_template = await self._template_repo.get_by_id(template_id)
            if old_template is None:
                raise ValueError("Form template not found")

            disease_id = old_template.disease_id
            new_version = old_template.version + 1

            await self._template_repo.deactivate_for_disease(disease_id)

            schema_dict = dict(schema)
            schema_dict["version"] = new_version
            schema_dict["disease_id"] = disease_id

            new_template = FormTemplateEntity(
                disease_id=disease_id,
                version=new_version,
                schema=schema_dict,
                is_active=True,
                created_by=actor.id,
            )
            new_template = await self._template_repo.add(new_template)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="template_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
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

    async def delete_template(self, *, template_id: int, actor: UserEntity) -> None:
        """Soft-delete a form template.

        Raises:
            ValueError: If template not found.
        """
        async with self._uow:
            template = await self._template_repo.get_by_id(template_id)
            if template is None:
                raise ValueError("Form template not found")

            template.is_active = False
            await self._template_repo.update(template)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="template_deleted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="form_template",
                    entity_id=template.id,
                    description=(
                        f"Form template id={template.id} v{template.version} "
                        f"(disease id={template.disease_id}) soft-deleted"
                    ),
                )
            )
            await self._uow.commit()
