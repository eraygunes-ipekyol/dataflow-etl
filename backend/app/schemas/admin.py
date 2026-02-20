"""
Superadmin DB yonetim paneli icin Pydantic semalari.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---- DB Stats ----

class TableInfo(BaseModel):
    name: str
    row_count: int


class DbStats(BaseModel):
    db_size_bytes: int
    db_size_display: str  # "12.5 MB" gibi
    db_file_bytes: int = 0
    wal_file_bytes: int = 0
    tables: list[TableInfo] = []
    total_rows: int = 0


# ---- Toplu Silme ----

class BulkDeleteByIds(BaseModel):
    """ID listesi ile secili kayitlari sil."""
    ids: list[int] = Field(..., min_length=1, description="Silinecek ID listesi")


class BulkDeleteByStringIds(BaseModel):
    """String ID listesi ile secili kayitlari sil (executions icin)."""
    ids: list[str] = Field(..., min_length=1, description="Silinecek ID listesi")


class BulkDeleteByDate(BaseModel):
    """Belirtilen tarihten onceki tum kayitlari sil."""
    date_before: datetime = Field(..., description="Bu tarihten onceki kayitlar silinir")


# ---- Admin Listeleme Response'lari ----

class AdminAuditLogItem(BaseModel):
    id: int
    username: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminExecutionLogItem(BaseModel):
    id: int
    execution_id: str
    node_id: Optional[str] = None
    level: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminExecutionItem(BaseModel):
    id: str
    workflow_id: str
    workflow_name: Optional[str] = None
    status: str
    trigger_type: str
    error_message: Optional[str] = None
    rows_processed: int = 0
    rows_failed: int = 0
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Paginated Response ----

class PaginatedAuditLogs(BaseModel):
    items: list[AdminAuditLogItem]
    total: int
    limit: int
    offset: int


class PaginatedExecutionLogs(BaseModel):
    items: list[AdminExecutionLogItem]
    total: int
    limit: int
    offset: int


class PaginatedExecutions(BaseModel):
    items: list[AdminExecutionItem]
    total: int
    limit: int
    offset: int


class BulkDeleteResult(BaseModel):
    deleted_count: int
    message: str
