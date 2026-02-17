from pydantic import BaseModel, Field

from app.schemas.connection import ColumnInfo


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
