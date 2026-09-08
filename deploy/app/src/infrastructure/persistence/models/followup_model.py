"""Followup ORM model."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.models.base import Base


class FollowupModel(Base):
    __tablename__ = "followups"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    assessment_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("assessments.id", ondelete="RESTRICT"), nullable=True
    )
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    patient: Mapped["PatientModel"] = relationship("PatientModel", foreign_keys=[patient_id])  # noqa: F821
    doctor: Mapped["UserModel"] = relationship("UserModel", foreign_keys=[doctor_id])  # noqa: F821
    assessment: Mapped[Optional["AssessmentModel"]] = relationship("AssessmentModel", foreign_keys=[assessment_id])  # noqa: F821

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'completed', 'cancelled')", name="ck_followups_status"),
        Index("idx_followups_patient_id", "patient_id"),
        Index("idx_followups_doctor_id", "doctor_id"),
        Index("idx_followups_status", "status"),
        Index("idx_followups_scheduled_date", "scheduled_date"),
        Index("idx_followups_doctor_status_date", "doctor_id", "status", "scheduled_date"),
    )
