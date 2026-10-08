"""SQLAlchemy implementation of AssessmentRepository."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Integer, and_, cast, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.entities.assessment import AssessmentEntity
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.infrastructure.persistence.models.assessment_model import AssessmentModel
from src.infrastructure.persistence.models.disease_model import DiseaseModel
from src.infrastructure.persistence.models.patient_model import PatientModel
from src.infrastructure.persistence.models.prescription_row_model import PrescriptionRowModel

# Age-group boundaries used by the dashboard filter panel. Each tuple is
# (min_age_inclusive, max_age_inclusive_or_None_for_no_upper_bound).
_AGE_GROUP_RANGES: dict[str, tuple[int, Optional[int]]] = {
    "0-17": (0, 17),
    "18-35": (18, 35),
    "36-50": (36, 50),
    "51-65": (51, 65),
    "66+": (66, None),
}


def _age_group_to_dob_range(age_group: str, today: Optional[date] = None) -> tuple[Optional[date], Optional[date]]:
    """Convert an age-group key (e.g. "18-35") into a (earliest_dob, latest_dob)
    range — i.e. the range of birth dates a patient must fall within to be
    that age today. Returns (None, None) for an unrecognized key."""
    bounds = _AGE_GROUP_RANGES.get(age_group)
    if bounds is None:
        return None, None
    min_age, max_age = bounds
    ref = today or date.today()

    def _years_ago(years: int) -> date:
        try:
            return ref.replace(year=ref.year - years)
        except ValueError:
            # Feb 29 on a non-leap target year — fall back to Feb 28.
            return ref.replace(month=2, day=28, year=ref.year - years)

    # A patient is `min_age` years old once their birthday has passed on or
    # before `ref - min_age years`; they stop being `max_age` the day after
    # `ref - max_age years` turns into `ref - (max_age+1) years`.
    latest_dob = _years_ago(min_age)  # youngest person still counted as min_age
    earliest_dob = _years_ago(max_age + 1) if max_age is not None else None
    if earliest_dob is not None:
        # Exclusive lower bound becomes inclusive by adding one day.
        from datetime import timedelta
        earliest_dob = earliest_dob + timedelta(days=1)
    return earliest_dob, latest_dob


class SqlAlchemyAssessmentRepository(AssessmentRepository):
    """Concrete assessment repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: AssessmentModel) -> AssessmentEntity:
        return AssessmentEntity(
            id=model.id,
            patient_id=model.patient_id,
            doctor_id=model.doctor_id,
            disease_id=model.disease_id,
            sub_disease_id=model.sub_disease_id,
            template_id=model.template_id,
            template_snapshot=model.template_snapshot,
            form_data=model.form_data,
            status=model.status,
            consent_given=model.consent_given,
            draft_saved_at=model.draft_saved_at,
            submitted_at=model.submitted_at,
            lock_expires_at=model.lock_expires_at,
            locked_at=model.locked_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: AssessmentEntity) -> AssessmentModel:
        return AssessmentModel(
            id=entity.id,
            patient_id=entity.patient_id,
            doctor_id=entity.doctor_id,
            disease_id=entity.disease_id,
            sub_disease_id=entity.sub_disease_id,
            template_id=entity.template_id,
            template_snapshot=entity.template_snapshot,
            form_data=entity.form_data,
            status=entity.status,
            consent_given=entity.consent_given,
            draft_saved_at=entity.draft_saved_at,
            submitted_at=entity.submitted_at,
            lock_expires_at=entity.lock_expires_at,
            locked_at=entity.locked_at,
        )

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, assessment_id: int) -> Optional[AssessmentEntity]:
        result = await self._session.get(AssessmentModel, assessment_id)
        return self._to_entity(result) if result else None

    # ------------------------------------------------------------------
    # Shared dashboard-filter helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_dashboard_filters(
        stmt,
        *,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ):
        """Apply the common dashboard filter set (doctor/disease/age/gender)
        to a SELECT statement against AssessmentModel. Age/gender filters are
        applied via a patient_id subquery, so this is safe to call regardless
        of whether the statement already joins PatientModel.
        """
        conditions = []

        if doctor_id is not None:
            conditions.append(AssessmentModel.doctor_id == doctor_id)
        if doctor_ids:
            conditions.append(AssessmentModel.doctor_id.in_(doctor_ids))
        if disease_ids:
            conditions.append(AssessmentModel.disease_id.in_(disease_ids))

        if gender or age_group:
            patient_filters = []
            if gender:
                patient_filters.append(func.lower(PatientModel.gender) == gender.lower())
            if age_group:
                earliest_dob, latest_dob = _age_group_to_dob_range(age_group)
                if earliest_dob is not None:
                    patient_filters.append(PatientModel.date_of_birth >= earliest_dob)
                if latest_dob is not None:
                    patient_filters.append(PatientModel.date_of_birth <= latest_dob)
            if patient_filters:
                matching_patient_ids = select(PatientModel.id).where(and_(*patient_filters))
                conditions.append(AssessmentModel.patient_id.in_(matching_patient_ids))

        if conditions:
            stmt = stmt.where(and_(*conditions))
        return stmt

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        patient_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> list[AssessmentEntity]:
        stmt = select(AssessmentModel)
        if patient_id is not None:
            stmt = stmt.where(AssessmentModel.patient_id == patient_id)
        if doctor_id is not None:
            stmt = stmt.where(AssessmentModel.doctor_id == doctor_id)
        if status is not None:
            stmt = stmt.where(AssessmentModel.status == status)
        stmt = stmt.order_by(AssessmentModel.id.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        patient_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> int:
        stmt = select(func.count(AssessmentModel.id))
        if patient_id is not None:
            stmt = stmt.where(AssessmentModel.patient_id == patient_id)
        if doctor_id is not None:
            stmt = stmt.where(AssessmentModel.doctor_id == doctor_id)
        if status is not None:
            stmt = stmt.where(AssessmentModel.status == status)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, assessment: AssessmentEntity) -> AssessmentEntity:
        model = self._to_model(assessment)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, assessment: AssessmentEntity) -> AssessmentEntity:
        model = await self._session.get(AssessmentModel, assessment.id)
        if model is None:
            raise ValueError(f"Assessment with id={assessment.id} not found")
        model.patient_id = assessment.patient_id
        model.doctor_id = assessment.doctor_id
        model.disease_id = assessment.disease_id
        model.sub_disease_id = assessment.sub_disease_id
        model.template_id = assessment.template_id
        model.template_snapshot = assessment.template_snapshot
        model.form_data = assessment.form_data
        model.status = assessment.status
        model.consent_given = assessment.consent_given
        model.draft_saved_at = assessment.draft_saved_at
        model.submitted_at = assessment.submitted_at
        model.lock_expires_at = assessment.lock_expires_at
        model.locked_at = assessment.locked_at
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, assessment_id: int) -> None:
        model = await self._session.get(AssessmentModel, assessment_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

    async def list_expired_for_locking(self, now: datetime) -> list[AssessmentEntity]:
        stmt = select(AssessmentModel).where(
            AssessmentModel.status == "submitted",
            AssessmentModel.lock_expires_at <= now,
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count_since(self, since: datetime, *, doctor_id: Optional[int] = None) -> int:
        stmt = select(func.count(AssessmentModel.id)).where(
            AssessmentModel.created_at >= since
        )
        if doctor_id is not None:
            stmt = stmt.where(AssessmentModel.doctor_id == doctor_id)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def count_distinct_patients(self, *, doctor_id: Optional[int] = None) -> int:
        stmt = select(func.count(AssessmentModel.patient_id.distinct()))
        if doctor_id is not None:
            stmt = stmt.where(AssessmentModel.doctor_id == doctor_id)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def get_monthly_volume(
        self,
        since: datetime,
        *,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> list[tuple[int, int, int]]:
        year_col = cast(extract("year", AssessmentModel.created_at), Integer)
        month_col = cast(extract("month", AssessmentModel.created_at), Integer)
        stmt = (
            select(year_col.label("yr"), month_col.label("mo"), func.count().label("cnt"))
            .where(AssessmentModel.created_at >= since)
            .group_by(year_col, month_col)
            .order_by(year_col, month_col)
        )
        stmt = self._apply_dashboard_filters(
            stmt,
            doctor_id=doctor_id,
            doctor_ids=doctor_ids,
            disease_ids=disease_ids,
            age_group=age_group,
            gender=gender,
        )
        result = await self._session.execute(stmt)
        return [(row.yr, row.mo, row.cnt) for row in result.all()]

    async def get_by_disease_distribution(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        *,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> list[tuple[str, int]]:
        stmt = (
            select(DiseaseModel.name.label("disease_name"), func.count(AssessmentModel.id).label("cnt"))
            .join(AssessmentModel, AssessmentModel.disease_id == DiseaseModel.id)
            .group_by(DiseaseModel.name)
            .order_by(func.count(AssessmentModel.id).desc())
        )
        if from_date is not None:
            stmt = stmt.where(AssessmentModel.created_at >= from_date)
        if to_date is not None:
            stmt = stmt.where(AssessmentModel.created_at <= to_date)
        stmt = self._apply_dashboard_filters(
            stmt,
            doctor_id=doctor_id,
            doctor_ids=doctor_ids,
            disease_ids=disease_ids,
            age_group=age_group,
            gender=gender,
        )
        result = await self._session.execute(stmt)
        return [(row.disease_name, row.cnt) for row in result.all()]

    async def get_daily_trend(
        self,
        start: datetime,
        end: datetime,
        *,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> list[tuple[int, int, int, int]]:
        year_col = cast(extract("year", AssessmentModel.created_at), Integer)
        month_col = cast(extract("month", AssessmentModel.created_at), Integer)
        day_col = cast(extract("day", AssessmentModel.created_at), Integer)
        stmt = (
            select(
                year_col.label("yr"),
                month_col.label("mo"),
                day_col.label("dy"),
                func.count().label("cnt"),
            )
            .where(AssessmentModel.created_at >= start, AssessmentModel.created_at <= end)
            .group_by(year_col, month_col, day_col)
            .order_by(year_col, month_col, day_col)
        )
        stmt = self._apply_dashboard_filters(
            stmt,
            doctor_id=doctor_id,
            doctor_ids=doctor_ids,
            disease_ids=disease_ids,
            age_group=age_group,
            gender=gender,
        )
        result = await self._session.execute(stmt)
        return [(r.yr, r.mo, r.dy, r.cnt) for r in result.all()]

    async def get_disease_summary(
        self,
        month_start: datetime,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        disease_id: Optional[int] = None,
        *,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> list[tuple[str, int, int, int, int]]:
        stmt = (
            select(
                DiseaseModel.name.label("disease_name"),
                func.count(AssessmentModel.id).label("total_count"),
                func.sum(cast(AssessmentModel.created_at >= month_start, Integer)).label("this_month_count"),
                func.sum(cast(AssessmentModel.status == "submitted", Integer)).label("submitted_count"),
                func.sum(cast(AssessmentModel.status == "locked", Integer)).label("locked_count"),
            )
            .join(AssessmentModel, AssessmentModel.disease_id == DiseaseModel.id)
            .group_by(DiseaseModel.id, DiseaseModel.name)
            .order_by(DiseaseModel.name)
        )
        filters = []
        if from_date is not None:
            filters.append(AssessmentModel.created_at >= from_date)
        if to_date is not None:
            filters.append(AssessmentModel.created_at <= to_date)
        if disease_id is not None:
            filters.append(AssessmentModel.disease_id == disease_id)
        if filters:
            stmt = stmt.where(*filters)
        stmt = self._apply_dashboard_filters(
            stmt,
            doctor_id=doctor_id,
            doctor_ids=doctor_ids,
            disease_ids=disease_ids,
            age_group=age_group,
            gender=gender,
        )
        result = await self._session.execute(stmt)
        return [
            (r.disease_name, r.total_count or 0, int(r.this_month_count or 0), int(r.submitted_count or 0), int(r.locked_count or 0))
            for r in result.all()
        ]

    async def get_statistics_rows(
        self,
        *,
        disease_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> list[tuple[dict, Optional[object]]]:
        stmt = select(AssessmentModel.form_data, PatientModel.date_of_birth).join(
            PatientModel, AssessmentModel.patient_id == PatientModel.id
        )
        if disease_id is not None:
            stmt = stmt.where(AssessmentModel.disease_id == disease_id)
        stmt = self._apply_dashboard_filters(
            stmt,
            doctor_id=doctor_id,
            doctor_ids=doctor_ids,
            disease_ids=disease_ids,
            age_group=age_group,
            gender=gender,
        )
        result = await self._session.execute(stmt)
        return [(row.form_data, row.date_of_birth) for row in result.all()]

    async def count_filtered(
        self,
        *,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> int:
        stmt = select(func.count(AssessmentModel.id))
        if from_date is not None:
            stmt = stmt.where(AssessmentModel.created_at >= from_date)
        if to_date is not None:
            stmt = stmt.where(AssessmentModel.created_at <= to_date)
        stmt = self._apply_dashboard_filters(
            stmt,
            doctor_id=doctor_id,
            doctor_ids=doctor_ids,
            disease_ids=disease_ids,
            age_group=age_group,
            gender=gender,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def count_distinct_patients_filtered(
        self,
        *,
        doctor_id: Optional[int] = None,
        doctor_ids: Optional[list[int]] = None,
        disease_ids: Optional[list[int]] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> int:
        stmt = select(func.count(AssessmentModel.patient_id.distinct()))
        if from_date is not None:
            stmt = stmt.where(AssessmentModel.created_at >= from_date)
        if to_date is not None:
            stmt = stmt.where(AssessmentModel.created_at <= to_date)
        stmt = self._apply_dashboard_filters(
            stmt,
            doctor_id=doctor_id,
            doctor_ids=doctor_ids,
            disease_ids=disease_ids,
            age_group=age_group,
            gender=gender,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def export_assessments_with_details(
        self,
        doctor_id: Optional[int] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> list[dict]:
        stmt = (
            select(AssessmentModel, PatientModel, DiseaseModel)
            .join(PatientModel, AssessmentModel.patient_id == PatientModel.id)
            .join(DiseaseModel, AssessmentModel.disease_id == DiseaseModel.id)
        )
        if doctor_id is not None:
            stmt = stmt.where(AssessmentModel.doctor_id == doctor_id)
        if from_date is not None:
            stmt = stmt.where(AssessmentModel.created_at >= from_date)
        if to_date is not None:
            stmt = stmt.where(AssessmentModel.created_at <= to_date)
        stmt = stmt.order_by(AssessmentModel.created_at.desc())
        result = await self._session.execute(stmt)
        rows = result.all()

        data = []
        for row in rows:
            a = row.AssessmentModel
            p = row.PatientModel
            d = row.DiseaseModel
            data.append({
                "assessment_id": a.id,
                "status": a.status,
                "created_at": a.created_at.isoformat(),
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
                "disease_name": d.name,
                "patient_uid": p.patient_uid,
                "patient_name": f"{p.first_name} {p.last_name}",
                "contact_number": p.contact_number,
                "gender": p.gender,
                "date_of_birth": p.date_of_birth.isoformat(),
                "form_data": a.form_data,
            })
        return data

    async def get_assessment_pdf_data(self, assessment_id: int) -> Optional[dict]:
        result = await self._session.execute(
            select(AssessmentModel)
            .options(selectinload(AssessmentModel.prescription_rows).selectinload(PrescriptionRowModel.medicine))
            .where(AssessmentModel.id == assessment_id)
        )
        assessment = result.scalar_one_or_none()
        if assessment is None:
            return None

        patient_result = await self._session.execute(
            select(PatientModel).where(PatientModel.id == assessment.patient_id)
        )
        patient = patient_result.scalar_one()

        disease_result = await self._session.execute(
            select(DiseaseModel).where(DiseaseModel.id == assessment.disease_id)
        )
        disease = disease_result.scalar_one()

        prescription_rows = [
            {
                "id": r.id,
                "medicine_id": r.medicine_id,
                "medicine_name": r.medicine.name if r.medicine else f"Medicine #{r.medicine_id}",
                "dosage": r.dosage,
                "frequency": r.frequency,
                "duration": r.duration,
                "instructions": r.instructions or "",
                "sort_order": r.sort_order,
            }
            for r in sorted(assessment.prescription_rows, key=lambda x: x.sort_order)
        ]

        return {
            "assessment": {
                "id": assessment.id,
                "doctor_id": assessment.doctor_id,
                "status": assessment.status,
                "form_data": assessment.form_data,
                "template_snapshot": assessment.template_snapshot,
                "consent_given": assessment.consent_given,
                "created_at": assessment.created_at.isoformat(),
                "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
                "locked_at": assessment.locked_at.isoformat() if assessment.locked_at else None,
            },
            "patient": {
                "id": patient.id,
                "patient_uid": patient.patient_uid,
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "date_of_birth": patient.date_of_birth.isoformat(),
                "gender": patient.gender,
                "contact_number": patient.contact_number,
                "email": patient.email,
            },
            "disease": {
                "id": disease.id,
                "name": disease.name,
            },
            "prescription_rows": prescription_rows,
        }
