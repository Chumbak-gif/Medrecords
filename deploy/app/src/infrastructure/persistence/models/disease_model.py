"""Disease and SubDisease ORM models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.models.base import Base


class DiseaseModel(Base):
    __tablename__ = "diseases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    creator: Mapped[Optional["UserModel"]] = relationship(  # noqa: F821
        "UserModel", back_populates="diseases_created", foreign_keys=[created_by]
    )
    sub_diseases: Mapped[list["SubDiseaseModel"]] = relationship(
        "SubDiseaseModel", back_populates="disease", cascade="all, delete-orphan"
    )
    form_templates: Mapped[list["FormTemplateModel"]] = relationship(  # noqa: F821
        "FormTemplateModel", back_populates="disease"
    )
    assessments: Mapped[list["AssessmentModel"]] = relationship(  # noqa: F821
        "AssessmentModel", back_populates="disease", foreign_keys="AssessmentModel.disease_id"
    )

    __table_args__ = (
        Index("idx_diseases_name", "name"),
        Index("idx_diseases_is_active", "is_active"),
    )


class SubDiseaseModel(Base):
    __tablename__ = "sub_diseases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    disease_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("diseases.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    disease: Mapped["DiseaseModel"] = relationship("DiseaseModel", back_populates="sub_diseases")
    assessments: Mapped[list["AssessmentModel"]] = relationship(  # noqa: F821
        "AssessmentModel", back_populates="sub_disease", foreign_keys="AssessmentModel.sub_disease_id"
    )

    __table_args__ = (
        UniqueConstraint("disease_id", "name", name="uq_sub_diseases_disease_id_name"),
        Index("idx_sub_diseases_disease_id", "disease_id"),
        Index("idx_sub_diseases_is_active", "is_active"),
    )
