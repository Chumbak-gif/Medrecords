from datetime import date, datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    patient_uid: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    contact_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    registered_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    registrar: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", back_populates="patients_registered", foreign_keys=[registered_by]
    )
    assessments: Mapped[list["Assessment"]] = relationship(  # noqa: F821
        "Assessment", back_populates="patient", foreign_keys="Assessment.patient_id"
    )
    consent_records: Mapped[list["ConsentRecord"]] = relationship(  # noqa: F821
        "ConsentRecord", back_populates="patient", foreign_keys="ConsentRecord.patient_id"
    )

    __table_args__ = (
        Index("idx_patients_contact_number", "contact_number"),
        Index("idx_patients_patient_uid", "patient_uid"),
        Index("idx_patients_registered_by", "registered_by"),
    )
