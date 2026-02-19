"""
Audit log servisi.
Tüm CRUD işlemlerini kullanıcı-tarih-saat bilgisiyle loglar.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.utils.logger import logger


def _serialize(value: Any) -> Optional[str]:
    """dict/list → JSON string. None ise None döner."""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return str(value)


def log_action(
    db: Session,
    user_id: Optional[str],
    username: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    old_value: Optional[Any] = None,
    new_value: Optional[Any] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Audit log kaydı oluşturur.

    action: "create" | "update" | "delete" | "restore" | "login"
    entity_type: "workflow" | "schedule" | "orchestration" | "connection" | "folder" | "user"
    """
    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        old_value=_serialize(old_value),
        new_value=_serialize(new_value),
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    logger.info(
        "[audit] %s %s %s/%s by %s",
        action, entity_type, entity_id or "-", entity_name or "-", username,
    )
    return entry


def list_audit_logs(
    db: Session,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    return (
        q.order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_workflow_history(db: Session, workflow_id: str) -> list[AuditLog]:
    """
    Workflow'a ait update ve restore log'larını döner.
    old_value içinde önceki definition saklanır → restore için kullanılır.
    """
    return (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_type == "workflow",
            AuditLog.entity_id == workflow_id,
            AuditLog.action.in_(["create", "update", "restore", "delete"]),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(50)
        .all()
    )
