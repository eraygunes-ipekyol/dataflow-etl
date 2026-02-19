"""
Audit log router — değişiklik geçmişi sorgulama.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.services import audit_service
from app.utils.auth_deps import get_current_user

router = APIRouter(
    prefix="/audit-logs",
    tags=["audit-logs"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    logs = audit_service.list_audit_logs(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/workflows/{workflow_id}/history", response_model=list[AuditLogResponse])
def get_workflow_history(
    workflow_id: str,
    db: Session = Depends(get_db),
):
    logs = audit_service.get_workflow_history(db, workflow_id)
    return [AuditLogResponse.model_validate(log) for log in logs]
