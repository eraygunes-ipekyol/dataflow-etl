import json
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, model_validator


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[str] = None
    username: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    old_value: Optional[Any] = None   # JSON parse edilmiş
    new_value: Optional[Any] = None   # JSON parse edilmiş
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def parse_json_fields(self) -> "AuditLogResponse":
        # old_value ve new_value DB'de Text/JSON string olarak saklanır,
        # response'da dict olarak döndürülür
        if isinstance(self.old_value, str):
            try:
                self.old_value = json.loads(self.old_value)
            except (json.JSONDecodeError, TypeError):
                pass
        if isinstance(self.new_value, str):
            try:
                self.new_value = json.loads(self.new_value)
            except (json.JSONDecodeError, TypeError):
                pass
        return self
