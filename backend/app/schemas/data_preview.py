from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field

from app.schemas.connection import ColumnInfo


class ColumnTransform(BaseModel):
    type: str  # rename | cast | default | expression | drop
    target_name: Optional[str] = None
    cast_to: Optional[str] = None
    default_value: Optional[str] = None
    expression: Optional[str] = None


class ColumnMapping(BaseModel):
    source_column: str
    target_column: str
    transforms: Optional[list[ColumnTransform]] = None
    skip: bool = False


class MappingPreviewRequest(BaseModel):
    connection_id: str
    schema_name: Optional[str] = None
    table_name: Optional[str] = None
    query: Optional[str] = None
    column_mappings: list[ColumnMapping] = Field(default_factory=list)
    limit: int = Field(50, ge=1, le=200)


class PreviewTableRequest(BaseModel):
    connection_id: str
    schema_name: str = Field("dbo", description="Şema adı")
    table_name: str = Field(..., description="Tablo adı")
    limit: int = Field(100, ge=1, le=500, description="Satır limiti")


class PreviewQueryRequest(BaseModel):
    connection_id: str
    query: str = Field(..., min_length=1, description="SQL sorgusu")
    limit: int = Field(100, ge=1, le=500, description="Satır limiti")


class PreviewResponse(BaseModel):
    columns: list[ColumnInfo]
    rows: list[dict]
    total_rows: int
    truncated: bool = False
