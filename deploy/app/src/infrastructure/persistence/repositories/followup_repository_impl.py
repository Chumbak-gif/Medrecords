"""SQLAlchemy implementation of FollowupRepository."""

from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.followup import FollowupEntity
from src.domain.repositories.followup_repository import FollowupRepository
from src.infrastructure.persistence.models.assessment_model import AssessmentModel
from src.infrastructure.persistence.models.disease_model import DiseaseModel
from src.infrastructure.persistence.models.followup_model import FollowupModel
from src.infrastructure.persistence.models.patient_model import PatientModel


class SqlAlchemyFollowupRepository(FollowupRepository):
    """Concrete followup repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: FollowupModel) -> FollowupEntity:
        return FollowupEntity(
            id=model.id,
            patient_id=model.patient_id,
            doctor_id=model.doctor_id,
            assessment_id=model.assessment_id,
            scheduled_date=model.scheduled_date,
            notes=model.notes,
            status=model.status,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: FollowupEntity) -> FollowupModel:
        return FollowupModel(
            id=entity.id,
            patient_id=entity.patient_id,
            doctor_id=entity.doctor_id,
            assessment_id=entity.assessment_id,
            scheduled_date=entity.scheduled_date,
            notes=entity.notes,
            status=entity.status,
        )

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, followup_id: int) -> Optional[FollowupEntity]:
        result = await self._session.get(FollowupModel, followup_id)
        return self._to_entity(result) if result else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
        scheduled_from: Optional[date] = None,
        scheduled_to: Optional[date] = None,
    ) -> list[FollowupEntity]:
        stmt = select(FollowupModel)
        if doctor_id is not None:
            stmt = stmt.where(FollowupModel.doctor_id == doctor_id)
        if patient_id is not None:
            stmt = stmt.where(FollowupModel.patient_id == patient_id)
        if status is not None:
            stmt = stmt.where(FollowupModel.status == status)
        if scheduled_from is not None:
            stmt = stmt.where(FollowupModel.scheduled_date >= scheduled_from)
        if scheduled_to is not None:
            stmt = stmt.where(FollowupModel.scheduled_date <= scheduled_to)
        stmt = stmt.order_by(FollowupModel.scheduled_date.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
        scheduled_from: Optional[date] = None,
        scheduled_to: Optional[date] = None,
    ) -> int:
        stmt = select(func.count(FollowupModel.id))
        if doctor_id is not None:
            stmt = stmt.where(FollowupModel.doctor_id == doctor_id)
        if patient_id is not None:
            stmt = stmt.where(FollowupModel.patient_id == patient_id)
        if status is not None:
            stmt = stmt.where(FollowupModel.status == status)
        if scheduled_from is not None:
            stmt = stmt.where(FollowupModel.scheduled_date >= scheduled_from)
        if scheduled_to is not None:
            stmt = stmt.where(FollowupModel.scheduled_date <= scheduled_to)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, followup: FollowupEntity) -> FollowupEntity:
        model = self._to_model(followup)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, followup: FollowupEntity) -> FollowupEntity:
        model = await self._session.get(FollowupModel, followup.id)
        if model is None:
            raise ValueError(f"Followup with id={followup.id} not found")
        model.patient_id = followup.patient_id
        model.doctor_id = followup.doctor_id
        model.assessment_id = followup.assessment_id
        model.scheduled_date = followup.scheduled_date
        model.notes = followup.notes
        model.status = followup.status
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, followup_id: int) -> None:
        model = await self._session.get(FollowupModel, followup_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

    # ------------------------------------------------------------------
    # Enriched methods (include patient/disease data)
    # ------------------------------------------------------------------

    async def _enrich_model(self, model: FollowupModel) -> dict:
        """Enrich a followup model with patient and disease info."""
        patient_name: Optional[str] = None
        patient_uid: Optional[str] = None
        disease_name: Optional[str] = None

        patient_result = await self._session.execute(
            select(PatientModel).where(PatientModel.id == model.patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient:
            patient_name = f"{patient.first_name} {patient.last_name}"
            patient_uid = patient.patient_uid

        if model.assessment_id:
            assessment_result = await self._session.execute(
                select(AssessmentModel).where(AssessmentModel.id == model.assessment_id)
            )
            assessment = assessment_result.scalar_one_or_none()
            if assessment and assessment.disease_id:
                disease_result = await self._session.execute(
                    select(DiseaseModel).where(DiseaseModel.id == assessment.disease_id)
                )
                disease = disease_result.scalar_one_or_none()
                if disease:
                    disease_name = disease.name

        return {
            "id": model.id,
            "patient_id": model.patient_id,
            "doctor_id": model.doctor_id,
            "assessment_id": model.assessment_id,
            "scheduled_date": model.scheduled_date,
            "notes": model.notes,
            "status": model.status,
            "created_at": model.created_at,
            "updated_at": model.updated_at,
            "patient_name": patient_name,
            "patient_uid": patient_uid,
            "disease_name": disease_name,
        }

    async def get_enriched(self, followup_id: int) -> Optional[dict]:
        model = await self._session.get(FollowupModel, followup_id)
        if model is None:
            return None
        return await self._enrich_model(model)

    async def list_enriched(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
        scheduled_from: Optional[date] = None,
        scheduled_to: Optional[date] = None,
    ) -> list[dict]:
        stmt = select(FollowupModel)
        if doctor_id is not None:
            stmt = stmt.where(FollowupModel.doctor_id == doctor_id)
        if patient_id is not None:
            stmt = stmt.where(FollowupModel.patient_id == patient_id)
        if status is not None:
            stmt = stmt.where(FollowupModel.status == status)
        if scheduled_from is not None:
            stmt = stmt.where(FollowupModel.scheduled_date >= scheduled_from)
        if scheduled_to is not None:
            stmt = stmt.where(FollowupModel.scheduled_date <= scheduled_to)
        stmt = stmt.order_by(FollowupModel.scheduled_date.asc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [await self._enrich_model(m) for m in models]
