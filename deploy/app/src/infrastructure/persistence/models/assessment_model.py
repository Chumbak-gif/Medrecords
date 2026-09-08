"""Assessment ORM model."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.models.base import Base


class AssessmentModel(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    disease_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("diseases.id", ondelete="RESTRICT"), nullable=False
    )
    sub_disease_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("sub_diseases.id", ondelete="RESTRICT"), nullable=True
    )
    template_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("form_templates.id", ondelete="RESTRICT"), nullable=False
    )
    template_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    form_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    draft_saved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    lock_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    patient: Mapped["PatientModel"] = relationship(  # noqa: F821
        "PatientModel", back_populates="assessments", foreign_keys=[patient_id]
    )
    doctor: Mapped["UserModel"] = relationship(  # noqa: F821
        "UserModel", back_populates="assessments_as_doctor", foreign_keys=[doctor_id]
    )
    disease: Mapped["DiseaseModel"] = relationship(  # noqa: F821
        "DiseaseModel", back_populates="assessments", foreign_keys=[disease_id]
    )
    sub_disease: Mapped[Optional["SubDiseaseModel"]] = relationship(  # noqa: F821
        "SubDiseaseModel", back_populates="assessments", foreign_keys=[sub_disease_id]
    )
    template: Mapped["FormTemplateModel"] = relationship(  # noqa: F821
        "FormTemplateModel", back_populates="assessments", foreign_keys=[template_id]
    )
    prescription_rows: Mapped[list["PrescriptionRowModel"]] = relationship(  # noqa: F821
        "PrescriptionRowModel", back_populates="assessment", cascade="all, delete-orphan"
    )
    consent_record: Mapped[Optional["ConsentRecordModel"]] = relationship(  # noqa: F821
        "ConsentRecordModel", back_populates="assessment", uselist=False
    )

    __table_args__ = (
        Index("idx_assessments_patient_id", "patient_id"),
        Index("idx_assessments_doctor_id", "doctor_id"),
        Index("idx_assessments_disease_id", "disease_id"),
        Index("idx_assessments_status", "status"),
        Index("idx_assessments_submitted_at", "submitted_at"),
        Index("idx_assessments_lock_expires_at", "lock_expires_at"),
    )
