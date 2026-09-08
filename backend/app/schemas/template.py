"""
Pydantic schemas for Form Template CRUD.

The JSON schema stored in form_templates.schema is validated via the
nested FieldSchema / SectionSchema / FormSchemaBody models.
"""
from datetime import datetime
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, field_validator, model_validator

# ---------------------------------------------------------------------------
# Validation rule sub-schema
# ---------------------------------------------------------------------------

class ValidationRules(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    min_date: Optional[str] = None
    max_date: Optional[str] = None

    model_config = {"populate_by_name": True, "extra": "ignore"}


# ---------------------------------------------------------------------------
# Allowed field types
# ---------------------------------------------------------------------------

FieldType = Literal[
    "text",
    "number",
    "date",
    "select",
    "multiselect",
    "radio",
    "checkbox_group",
    "textarea",
]


# ---------------------------------------------------------------------------
# Field schema (one entry in a section's fields array)
# ---------------------------------------------------------------------------

class FieldSchema(BaseModel):
    field_key: str
    label: str
    type: FieldType
    required: bool
    validation: Optional[ValidationRules] = None
    options: Optional[list[str]] = None
    placeholder: Optional[str] = None
    order: Optional[int] = None

    @field_validator("field_key")
    @classmethod
    def field_key_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("field_key must not be blank")
        return v

    @field_validator("label")
    @classmethod
    def label_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("label must not be blank")
        return v


# ---------------------------------------------------------------------------
# Section schema
# ---------------------------------------------------------------------------

class SectionSchema(BaseModel):
    section_key: str
    label: str
    order: Optional[int] = None
    fields: list[FieldSchema]

    @field_validator("section_key")
    @classmethod
    def section_key_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("section_key must not be blank")
        return v

    @field_validator("label")
    @classmethod
    def label_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("label must not be blank")
        return v

    @field_validator("fields")
    @classmethod
    def at_least_one_field(cls, v: list[FieldSchema]) -> list[FieldSchema]:
        if not v:
            raise ValueError("Each section must have at least one field")
        return v

    @model_validator(mode="after")
    def field_keys_unique(self) -> "SectionSchema":
        """Within a section, all field_key values must be unique."""
        keys = [f.field_key for f in self.fields]
        if len(keys) != len(set(keys)):
            duplicates = {k for k in keys if keys.count(k) > 1}
            raise ValueError(
                f"Duplicate field_key(s) within section '{self.section_key}': "
                + ", ".join(sorted(duplicates))
            )
        return self


# ---------------------------------------------------------------------------
# Top-level form schema body (the value stored in the JSONB column)
# ---------------------------------------------------------------------------

class FormSchemaBody(BaseModel):
    """Represents the contents of form_templates.schema (JSONB)."""

    sections: list[SectionSchema]
    # version and disease_id inside the schema body are informational only;
    # the canonical values live on the ORM columns.
    version: Optional[int] = None
    disease_id: Optional[int] = None

    @field_validator("sections")
    @classmethod
    def at_least_one_section(cls, v: list[SectionSchema]) -> list[SectionSchema]:
        if not v:
            raise ValueError("At least one section must exist")
        return v


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class FormTemplateCreate(BaseModel):
    disease_id: int
    schema: FormSchemaBody


class FormTemplateUpdate(BaseModel):
    """For PUT /{id} — replaces the active template with a new version."""
    schema: FormSchemaBody


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class FormTemplateResponse(BaseModel):
    id: int
    disease_id: int
    version: int
    schema: dict[str, Any]
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
