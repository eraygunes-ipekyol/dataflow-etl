from __future__ import annotations

from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel, Field


class MssqlConfig(BaseModel):
    host: str = Field(..., description="Sunucu adresi")
    port: int = Field(1433, description="Port numarası")
    database: str = Field(..., description="Veritabanı adı")
    username: str = Field(..., description="Kullanıcı adı")
    password: str = Field(..., description="Şifre")
    driver: str = Field("ODBC Driver 18 for SQL Server", description="ODBC sürücüsü")
    trust_server_certificate: bool = Field(True, description="Sunucu sertifikasına güven")
    encrypt: bool = Field(False, description="Bağlantıyı şifrele")


class BigQueryConfig(BaseModel):
    project_id: str = Field(..., description="Google Cloud proje ID")
    dataset: str = Field("", description="Varsayılan dataset")
    credentials_json: str = Field(..., description="Service account JSON key içeriği")


class ConnectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Bağlantı adı")
    type: str = Field(..., pattern="^(mssql|bigquery)$", description="Bağlantı tipi")
    config: Union[MssqlConfig, BigQueryConfig]


class ConnectionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    config: Optional[Union[MssqlConfig, BigQueryConfig]] = None
    is_active: Optional[bool] = None


class ConnectionResponse(BaseModel):
    id: str
    name: str
    type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionDetail(ConnectionResponse):
    config: dict  # şifresi çözülmüş config (password maskelenmiş)


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    details: Optional[dict] = None


class SchemaInfo(BaseModel):
    name: str


class TableInfo(BaseModel):
    name: str
    schema_name: str
    row_count: Optional[int] = None


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    nullable: bool = True
    max_length: Optional[int] = None
    is_primary_key: bool = False
