from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ExecutionResponse(BaseModel):
    id: str
    workflow_id: str
    workflow_name: Optional[str] = None   # JOIN ile doldurulur
    folder_id: Optional[str] = None       # Workflow'un klasörü
    folder_path: Optional[str] = None     # Üst > Alt klasör yolu (örn: "Satış > Günlük")
    status: str
    trigger_type: str
    error_message: Optional[str] = None
    rows_processed: int
    rows_failed: int
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExecutionLogResponse(BaseModel):
    id: int
    execution_id: str
    node_id: Optional[str] = None
    level: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ExecutionDetail(ExecutionResponse):
    logs: list[ExecutionLogResponse] = []


class TimelineNodeEntry(BaseModel):
    node_id: str
    node_label: str
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    status: str  # success | failed
    row_count: int


class ExecutionTimeline(BaseModel):
    execution_id: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    total_duration_seconds: float = 0
    nodes: list[TimelineNodeEntry] = []
