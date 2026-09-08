"""DiseaseService — consolidated business logic for disease management."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.disease import DiseaseEntity, SubDiseaseEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.disease_repository import IDiseaseRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class PaginatedResult:
    """Paginated result container for diseases."""

    items: list[DiseaseEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


@dataclass
class DiseaseWithSubDiseases:
    """Disease entity bundled with its sub-diseases."""

    disease: DiseaseEntity
    sub_diseases: list[SubDiseaseEntity]


class DiseaseService:
    """Consolidated service for disease management operations."""

    def __init__(
        self,
        disease_repo: IDiseaseRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._disease_repo = disease_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def list_diseases(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str = "",
        include_inactive: bool = False,
    ) -> PaginatedResult:
        """List diseases with pagination and optional search/active filtering."""
        is_active = None if include_inactive else True
        offset = (page - 1) * page_size

        diseases = await self._disease_repo.list(
            offset=offset, limit=page_size, search=search, is_active=is_active
        )
        total = await self._disease_repo.count(search=search, is_active=is_active)
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=diseases, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    async def get_disease(self, *, disease_id: int) -> DiseaseWithSubDiseases:
        """Retrieve a disease and its sub-diseases.

        Raises:
            ValueError: If the disease does not exist.
        """
        disease = await self._disease_repo.get_by_id(disease_id)
        if disease is None:
            raise ValueError("Disease not found")

        sub_diseases = await self._disease_repo.list_sub_diseases(disease_id, include_inactive=True)
        return DiseaseWithSubDiseases(disease=disease, sub_diseases=sub_diseases)

    async def create_disease(
        self, *, name: str, description: Optional[str] = None, actor: UserEntity
    ) -> DiseaseEntity:
        """Create a new disease (admin/sys_admin only).

        Raises:
            ValueError: If the actor lacks permission or name already exists.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            existing = await self._disease_repo.get_by_name(name)
            if existing is not None:
                raise ValueError(f"A disease named '{name}' already exists")

            disease = DiseaseEntity(name=name, description=description, created_by=actor.id)
            disease = await self._disease_repo.add(disease)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_created",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' created",
                )
            )
            await self._uow.commit()
            return disease

    async def update_disease(
        self,
        *,
        disease_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_active: Optional[bool] = None,
        actor: UserEntity,
    ) -> DiseaseEntity:
        """Update a disease (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission, disease not found, or name conflict.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            disease = await self._disease_repo.get_by_id(disease_id)
            if disease is None:
                raise ValueError("Disease not found")

            if name is not None and name.lower() != disease.name.lower():
                existing = await self._disease_repo.get_by_name(name)
                if existing is not None and existing.id != disease.id:
                    raise ValueError(f"A disease named '{name}' already exists")
                disease.name = name

            if description is not None:
                disease.description = description
            if is_active is not None:
                disease.is_active = is_active

            disease = await self._disease_repo.update(disease)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' updated",
                )
            )
            await self._uow.commit()
            return disease

    async def delete_disease(self, *, disease_id: int, actor: UserEntity) -> None:
        """Soft-delete a disease and cascade to sub-diseases (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission, disease not found, or has linked assessments.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            disease = await self._disease_repo.get_by_id(disease_id)
            if disease is None:
                raise ValueError("Disease not found")

            assessment_count = await self._disease_repo.get_assessment_count(disease_id)
            if assessment_count > 0:
                raise ValueError(
                    f"Cannot delete disease '{disease.name}': {assessment_count} assessment(s) are linked to it"
                )

            disease.is_active = False
            await self._disease_repo.update(disease)

            sub_diseases = await self._disease_repo.list_sub_diseases(disease_id, include_inactive=False)
            for sub in sub_diseases:
                sub.is_active = False
                await self._disease_repo.update_sub_disease(sub)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_deleted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' soft-deleted (cascaded to sub-diseases)",
                )
            )
            await self._uow.commit()

    async def restore_disease(self, *, disease_id: int, actor: UserEntity) -> DiseaseEntity:
        """Restore a soft-deleted disease (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission, disease not found, or already active.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            disease = await self._disease_repo.get_by_id(disease_id)
            if disease is None:
                raise ValueError("Disease not found")
            if disease.is_active:
                raise ValueError("Disease is already active")

            disease.is_active = True
            disease = await self._disease_repo.update(disease)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_restored",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' restored",
                )
            )
            await self._uow.commit()
            return disease

    async def list_sub_diseases(
        self, *, disease_id: int, include_inactive: bool = False
    ) -> list[SubDiseaseEntity]:
        """List sub-diseases for a disease.

        Raises:
            ValueError: If the parent disease does not exist.
        """
        disease = await self._disease_repo.get_by_id(disease_id)
        if disease is None:
            raise ValueError("Disease not found")
        return await self._disease_repo.list_sub_diseases(disease_id, include_inactive=include_inactive)

    async def create_sub_disease(
        self, *, disease_id: int, name: str, actor: UserEntity
    ) -> SubDiseaseEntity:
        """Create a new sub-disease (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission, disease not found, or name conflict.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            disease = await self._disease_repo.get_by_id(disease_id)
            if disease is None:
                raise ValueError("Disease not found")

            existing = await self._disease_repo.get_sub_disease_by_name(disease_id, name)
            if existing is not None:
                raise ValueError(f"Sub-disease '{name}' already exists for this disease")

            sub = SubDiseaseEntity(disease_id=disease_id, name=name)
            sub = await self._disease_repo.add_sub_disease(sub)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="sub_disease_created",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="sub_disease",
                    entity_id=sub.id,
                    description=f"Sub-disease '{sub.name}' created under disease '{disease.name}'",
                )
            )
            await self._uow.commit()
            return sub

    async def update_sub_disease(
        self,
        *,
        disease_id: int,
        sub_disease_id: int,
        name: Optional[str] = None,
        is_active: Optional[bool] = None,
        actor: UserEntity,
    ) -> SubDiseaseEntity:
        """Update a sub-disease (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission, sub-disease not found, or name conflict.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            sub = await self._disease_repo.get_sub_disease(sub_disease_id, disease_id)
            if sub is None:
                raise ValueError("Sub-disease not found")

            if name is not None and name.lower() != sub.name.lower():
                existing = await self._disease_repo.get_sub_disease_by_name(disease_id, name)
                if existing is not None and existing.id != sub.id:
                    raise ValueError(f"Sub-disease '{name}' already exists for this disease")
                sub.name = name

            if is_active is not None:
                sub.is_active = is_active

            sub = await self._disease_repo.update_sub_disease(sub)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="sub_disease_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="sub_disease",
                    entity_id=sub.id,
                    description=f"Sub-disease '{sub.name}' (id={sub.id}) updated",
                )
            )
            await self._uow.commit()
            return sub

    async def delete_sub_disease(
        self, *, disease_id: int, sub_disease_id: int, actor: UserEntity
    ) -> None:
        """Soft-delete a sub-disease (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission or sub-disease not found.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            sub = await self._disease_repo.get_sub_disease(sub_disease_id, disease_id)
            if sub is None:
                raise ValueError("Sub-disease not found")

            sub.is_active = False
            await self._disease_repo.update_sub_disease(sub)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="sub_disease_deleted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="sub_disease",
                    entity_id=sub.id,
                    description=f"Sub-disease '{sub.name}' (id={sub.id}) soft-deleted",
                )
            )
            await self._uow.commit()
