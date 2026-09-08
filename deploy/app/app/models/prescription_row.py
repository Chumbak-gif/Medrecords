from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PrescriptionRow(Base):
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
    assessment: Mapped["Assessment"] = relationship(  # noqa: F821
        "Assessment", back_populates="prescription_rows"
    )
    medicine: Mapped["Medicine"] = relationship(  # noqa: F821
        "Medicine", back_populates="prescription_rows"
    )

    __table_args__ = (
        Index("idx_prescription_rows_assessment_id", "assessment_id"),
    )
