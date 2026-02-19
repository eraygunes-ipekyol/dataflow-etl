from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Klasör adı")
    parent_id: Optional[str] = Field(None, description="Üst klasör ID (root için None)")


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_id: Optional[str] = None


class FolderResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FolderTree(FolderResponse):
    children: list[FolderTree] = []
    workflows: list[dict] = []  # Basit workflow listesi (id, name)
