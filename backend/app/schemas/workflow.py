from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Workflow adı")
    description: Optional[str] = Field(None, description="Workflow açıklaması")
    folder_id: Optional[str] = Field(None, description="Klasör ID")
    definition: dict[str, Any] = Field(
        default_factory=lambda: {"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
        description="Workflow tanımı (nodes, edges, viewport)",
    )


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    folder_id: Optional[str] = None
    definition: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None
    notification_webhook_url: Optional[str] = None
    notification_on_failure: Optional[bool] = None
    notification_on_success: Optional[bool] = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    folder_id: Optional[str]
    version: int
    is_active: bool
    notification_webhook_url: Optional[str] = None
    notification_on_failure: bool = True
    notification_on_success: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowDetail(WorkflowResponse):
    definition: dict[str, Any]


class WorkflowValidationResult(BaseModel):
    valid: bool
    errors: list[str] = []
    warnings: list[str] = []
