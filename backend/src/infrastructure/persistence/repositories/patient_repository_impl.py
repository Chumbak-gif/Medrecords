"""SQLAlchemy implementation of PatientRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.patient import PatientEntity
from src.domain.repositories.patient_repository import PatientRepository
from src.infrastructure.persistence.models.patient_model import PatientModel


class SqlAlchemyPatientRepository(PatientRepository):
    """Concrete patient repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: PatientModel) -> PatientEntity:
        return PatientEntity(
            id=model.id,
            patient_uid=model.patient_uid,
            first_name=model.first_name,
            last_name=model.last_name,
            date_of_birth=model.date_of_birth,
            gender=model.gender,
            contact_number=model.contact_number,
            email=model.email,
            registered_by=model.registered_by,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: PatientEntity) -> PatientModel:
        return PatientModel(
            id=entity.id,
            patient_uid=entity.patient_uid,
            first_name=entity.first_name,
            last_name=entity.last_name,
            date_of_birth=entity.date_of_birth,
            gender=entity.gender,
            contact_number=entity.contact_number,
            email=entity.email,
            registered_by=entity.registered_by,
            is_active=entity.is_active,
        )

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, patient_id: int) -> Optional[PatientEntity]:
        result = await self._session.get(PatientModel, patient_id)
        return self._to_entity(result) if result else None

    async def get_by_contact_number(self, contact_number: str) -> Optional[PatientEntity]:
        stmt = select(PatientModel).where(PatientModel.contact_number == contact_number)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_uid(self, patient_uid: str) -> Optional[PatientEntity]:
        stmt = select(PatientModel).where(PatientModel.patient_uid == patient_uid)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        doctor_id: Optional[int] = None,
        search: str = "",
    ) -> list[PatientEntity]:
        stmt = select(PatientModel)
        if doctor_id is not None:
            stmt = stmt.where(PatientModel.registered_by == doctor_id)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    PatientModel.first_name.ilike(pattern),
                    PatientModel.last_name.ilike(pattern),
                    PatientModel.patient_uid.ilike(pattern),
                    PatientModel.contact_number.ilike(pattern),
                )
            )
        stmt = stmt.order_by(PatientModel.id.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        doctor_id: Optional[int] = None,
        search: str = "",
    ) -> int:
        stmt = select(func.count(PatientModel.id))
        if doctor_id is not None:
            stmt = stmt.where(PatientModel.registered_by == doctor_id)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    PatientModel.first_name.ilike(pattern),
                    PatientModel.last_name.ilike(pattern),
                    PatientModel.patient_uid.ilike(pattern),
                    PatientModel.contact_number.ilike(pattern),
                )
            )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, patient: PatientEntity) -> PatientEntity:
        model = self._to_model(patient)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, patient: PatientEntity) -> PatientEntity:
        model = await self._session.get(PatientModel, patient.id)
        if model is None:
            raise ValueError(f"Patient with id={patient.id} not found")
        model.patient_uid = patient.patient_uid
        model.first_name = patient.first_name
        model.last_name = patient.last_name
        model.date_of_birth = patient.date_of_birth
        model.gender = patient.gender
        model.contact_number = patient.contact_number
        model.email = patient.email
        model.registered_by = patient.registered_by
        model.is_active = patient.is_active
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, patient_id: int) -> None:
        model = await self._session.get(PatientModel, patient_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()
