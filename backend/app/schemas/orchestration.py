from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ─── Step ─────────────────────────────────────────────────────────────────

class OrchestrationStepBase(BaseModel):
    workflow_id: str
    order_index: int = 0
    retry_count: int = Field(default=0, ge=0, le=10)
    retry_delay_seconds: int = Field(default=30, ge=0, le=3600)
    timeout_seconds: int = Field(default=0, ge=0, le=86400)
    on_failure: str = Field(default="stop", pattern="^(stop|continue)$")


class OrchestrationStepCreate(OrchestrationStepBase):
    pass


class OrchestrationStepUpdate(BaseModel):
    workflow_id: Optional[str] = None
    order_index: Optional[int] = None
    retry_count: Optional[int] = Field(default=None, ge=0, le=10)
    retry_delay_seconds: Optional[int] = Field(default=None, ge=0, le=3600)
    timeout_seconds: Optional[int] = Field(default=None, ge=0, le=86400)
    on_failure: Optional[str] = None


class OrchestrationStepResponse(OrchestrationStepBase):
    id: str
    orchestration_id: str
    workflow_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Orchestration ─────────────────────────────────────────────────────────

class OrchestrationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    cron_expression: str = Field(..., min_length=3)
    is_active: bool = True
    on_error: str = Field(default="stop", pattern="^(stop|continue)$")
    steps: list[OrchestrationStepCreate] = Field(default_factory=list)


class OrchestrationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    cron_expression: Optional[str] = None
    is_active: Optional[bool] = None
    on_error: Optional[str] = None
    steps: Optional[list[OrchestrationStepCreate]] = None  # Tüm adımları değiştirir


class OrchestrationResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    cron_expression: str
    is_active: bool
    on_error: str
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    steps: list[OrchestrationStepResponse] = []

    model_config = {"from_attributes": True}


# ─── Run result ────────────────────────────────────────────────────────────

class OrchestrationRunResult(BaseModel):
    orchestration_id: str
    orchestration_name: str
    total_steps: int
    completed_steps: int
    failed_steps: int
    skipped_steps: int
    execution_ids: list[str]
    status: str  # success | partial | failed
