from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FormTemplate(Base):
    __tablename__ = "form_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    disease_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("diseases.id", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    schema: Mapped[dict] = mapped_column(JSONB, nullable=False)
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
    disease: Mapped["Disease"] = relationship(  # noqa: F821
        "Disease", back_populates="form_templates"
    )
    creator: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", back_populates="templates_created", foreign_keys=[created_by]
    )
    assessments: Mapped[list["Assessment"]] = relationship(  # noqa: F821
        "Assessment", back_populates="template", foreign_keys="Assessment.template_id"
    )

    __table_args__ = (
        Index("idx_form_templates_disease_id", "disease_id"),
        Index("idx_form_templates_is_active", "is_active"),
    )
