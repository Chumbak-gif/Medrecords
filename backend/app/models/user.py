from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    specialty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    diseases_created: Mapped[list["Disease"]] = relationship(  # noqa: F821
        "Disease", back_populates="creator", foreign_keys="Disease.created_by"
    )
    templates_created: Mapped[list["FormTemplate"]] = relationship(  # noqa: F821
        "FormTemplate", back_populates="creator", foreign_keys="FormTemplate.created_by"
    )
    patients_registered: Mapped[list["Patient"]] = relationship(  # noqa: F821
        "Patient", back_populates="registrar", foreign_keys="Patient.registered_by"
    )
    assessments_as_doctor: Mapped[list["Assessment"]] = relationship(  # noqa: F821
        "Assessment", back_populates="doctor", foreign_keys="Assessment.doctor_id"
    )
    consent_records_as_doctor: Mapped[list["ConsentRecord"]] = relationship(  # noqa: F821
        "ConsentRecord", back_populates="doctor", foreign_keys="ConsentRecord.doctor_id"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(  # noqa: F821
        "AuditLog", back_populates="actor", foreign_keys="AuditLog.actor_id"
    )
    config_updates: Mapped[list["AppConfig"]] = relationship(  # noqa: F821
        "AppConfig", back_populates="updater", foreign_keys="AppConfig.updated_by"
    )

    __table_args__ = (
        Index("idx_users_username", "username"),
        Index("idx_users_role", "role"),
        Index("idx_users_is_active", "is_active"),
    )
