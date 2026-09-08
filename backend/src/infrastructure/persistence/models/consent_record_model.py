"""ConsentRecord ORM model."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.models.base import Base


class ConsentRecordModel(Base):
    __tablename__ = "consent_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    assessment_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("assessments.id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    consent_statement_version: Mapped[str] = mapped_column(String(20), nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    assessment: Mapped["AssessmentModel"] = relationship(  # noqa: F821
        "AssessmentModel", back_populates="consent_record"
    )
    patient: Mapped["PatientModel"] = relationship(  # noqa: F821
        "PatientModel", back_populates="consent_records", foreign_keys=[patient_id]
    )
    doctor: Mapped["UserModel"] = relationship(  # noqa: F821
        "UserModel", back_populates="consent_records_as_doctor", foreign_keys=[doctor_id]
    )

    __table_args__ = (
        Index("idx_consent_records_patient_id", "patient_id"),
        Index("idx_consent_records_assessment_id", "assessment_id"),
    )
