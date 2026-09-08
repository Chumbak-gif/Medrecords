"""Medicine ORM model."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.models.base import Base


class MedicineModel(Base):
    __tablename__ = "medicines"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    brand_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    strength: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    form: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    prescription_rows: Mapped[list["PrescriptionRowModel"]] = relationship(  # noqa: F821
        "PrescriptionRowModel", back_populates="medicine"
    )

    __table_args__ = (
        Index("idx_medicines_name", "name"),
        Index("idx_medicines_is_active", "is_active"),
    )
