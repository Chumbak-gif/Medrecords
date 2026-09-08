"""PrescriptionRow ORM model."""

from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.models.base import Base


class PrescriptionRowModel(Base):
    __tablename__ = "prescription_rows"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    assessment_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("assessments.id", ondelete="RESTRICT"), nullable=False
    )
    medicine_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("medicines.id", ondelete="RESTRICT"), nullable=False
    )
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)
    duration: Mapped[str] = mapped_column(String(100), nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    assessment: Mapped["AssessmentModel"] = relationship(  # noqa: F821
        "AssessmentModel", back_populates="prescription_rows"
    )
    medicine: Mapped["MedicineModel"] = relationship(  # noqa: F821
        "MedicineModel", back_populates="prescription_rows"
    )

    __table_args__ = (
        Index("idx_prescription_rows_assessment_id", "assessment_id"),
    )
