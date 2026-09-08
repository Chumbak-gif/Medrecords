"""User ORM model."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.models.base import Base


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    specialty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    diseases_created: Mapped[list["DiseaseModel"]] = relationship(  # noqa: F821
        "DiseaseModel", back_populates="creator", foreign_keys="DiseaseModel.created_by"
    )
    templates_created: Mapped[list["FormTemplateModel"]] = relationship(  # noqa: F821
        "FormTemplateModel", back_populates="creator", foreign_keys="FormTemplateModel.created_by"
    )
    patients_registered: Mapped[list["PatientModel"]] = relationship(  # noqa: F821
        "PatientModel", back_populates="registrar", foreign_keys="PatientModel.registered_by"
    )
    assessments_as_doctor: Mapped[list["AssessmentModel"]] = relationship(  # noqa: F821
        "AssessmentModel", back_populates="doctor", foreign_keys="AssessmentModel.doctor_id"
    )
    consent_records_as_doctor: Mapped[list["ConsentRecordModel"]] = relationship(  # noqa: F821
        "ConsentRecordModel", back_populates="doctor", foreign_keys="ConsentRecordModel.doctor_id"
    )
    audit_logs: Mapped[list["AuditLogModel"]] = relationship(  # noqa: F821
        "AuditLogModel", back_populates="actor", foreign_keys="AuditLogModel.actor_id"
    )
    config_updates: Mapped[list["AppConfigModel"]] = relationship(  # noqa: F821
        "AppConfigModel", back_populates="updater", foreign_keys="AppConfigModel.updated_by"
    )

    __table_args__ = (
        Index("idx_users_username", "username"),
        Index("idx_users_role", "role"),
        Index("idx_users_is_active", "is_active"),
    )
