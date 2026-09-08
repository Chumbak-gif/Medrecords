"""SQLAlchemy implementation of PatientUidGenerator."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.services.patient_uid_generator import PatientUidGenerator
from src.domain.value_objects.patient_uid import PatientUid
from src.infrastructure.persistence.models.patient_model import PatientModel


class SqlAlchemyPatientUidGenerator(PatientUidGenerator):
    """Generates the next sequential patient UID by querying MAX(patient_uid) from DB."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def generate_next(self) -> PatientUid:
        """Query the maximum patient_uid and increment by one.

        Returns PAT-000001 if no patients exist yet.
        """
        stmt = select(func.max(PatientModel.patient_uid))
        result = await self._session.execute(stmt)
        max_uid: str | None = result.scalar_one_or_none()

        if max_uid is None:
            return PatientUid.from_sequence(1)

        # Extract numeric part from PAT-XXXXXX format
        numeric_part = int(max_uid.replace("PAT-", ""))
        return PatientUid.from_sequence(numeric_part + 1)
