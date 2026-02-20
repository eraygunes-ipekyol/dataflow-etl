"""
Superadmin DB yonetim paneli endpointleri.
Veritabani boyutunu goruntuleme, log/execution kayitlarini filtreleme ve toplu silme.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db, engine
from app.config import settings
from app.models.audit_log import AuditLog
from app.models.execution import Execution, ExecutionLog
from app.models.workflow import Workflow
from app.models.user import User
from app.schemas.admin import (
    AdminAuditLogItem,
    AdminExecutionItem,
    AdminExecutionLogItem,
    BulkDeleteByDate,
    BulkDeleteByIds,
    BulkDeleteByStringIds,
    BulkDeleteResult,
    DbStats,
    PaginatedAuditLogs,
    PaginatedExecutionLogs,
    PaginatedExecutions,
    TableInfo,
)
from app.utils.auth_deps import require_superadmin
from app.utils.logger import logger

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_superadmin)],
)


# ---- Helpers ----

def _get_db_path() -> str:
    """SQLite DB dosya yolunu doner."""
    return settings.database_url.replace("sqlite:///", "")


def _format_size(size_bytes: int) -> str:
    """Byte degerini okunabilir formata donusturur."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


# ---- DB Stats ----

@router.get("/db-stats", response_model=DbStats)
async def get_db_stats(db: Session = Depends(get_db)):
    """Veritabani boyutu ve tablo bazli satir sayilari."""

    def _stats():
        # DB dosya boyutu
        db_path = _get_db_path()
        try:
            db_file_bytes = os.path.getsize(db_path)
        except OSError:
            db_file_bytes = 0

        # WAL dosyasi varsa onu da ekle
        wal_path = db_path + "-wal"
        try:
            wal_file_bytes = os.path.getsize(wal_path)
        except OSError:
            wal_file_bytes = 0

        db_size = db_file_bytes + wal_file_bytes

        # Tablo satir sayilari
        tables_info = []
        table_models = [
            ("audit_logs", AuditLog),
            ("execution_logs", ExecutionLog),
            ("executions", Execution),
            ("workflows", Workflow),
            ("users", User),
        ]

        total_rows = 0
        for table_name, model in table_models:
            try:
                count = db.query(func.count()).select_from(model).scalar() or 0
            except Exception:
                count = 0
            tables_info.append(TableInfo(name=table_name, row_count=count))
            total_rows += count

        return DbStats(
            db_size_bytes=db_size,
            db_size_display=_format_size(db_size),
            db_file_bytes=db_file_bytes,
            wal_file_bytes=wal_file_bytes,
            tables=tables_info,
            total_rows=total_rows,
        )

    return await run_in_threadpool(_stats)


# ---- VACUUM ----

@router.post("/vacuum", response_model=BulkDeleteResult)
async def vacuum_database(db: Session = Depends(get_db)):
    """SQLite VACUUM - kullanilmayan alani geri kazanir, DB dosyasini kucultur."""

    def _vacuum():
        db_path = _get_db_path()
        try:
            size_before = os.path.getsize(db_path)
        except OSError:
            size_before = 0

        # VACUUM requires being outside a transaction
        connection = engine.raw_connection()
        try:
            connection.execute("VACUUM")
            connection.close()
        except Exception as e:
            connection.close()
            raise HTTPException(status_code=500, detail=f"VACUUM basarisiz: {e}")

        try:
            size_after = os.path.getsize(db_path)
        except OSError:
            size_after = 0

        saved = size_before - size_after
        logger.info("VACUUM tamamlandi. Onceki: %s, Sonraki: %s, Kazanilan: %s",
                     _format_size(size_before), _format_size(size_after), _format_size(saved))

        return BulkDeleteResult(
            deleted_count=0,
            message=f"VACUUM tamamlandi. {_format_size(saved)} alan kazanildi. "
                    f"Yeni boyut: {_format_size(size_after)}",
        )

    return await run_in_threadpool(_vacuum)


# ---- Audit Logs ----

@router.get("/audit-logs", response_model=PaginatedAuditLogs)
async def list_audit_logs(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Filtrelenebilir audit log listesi."""

    def _query():
        q = db.query(AuditLog)
        count_q = db.query(func.count()).select_from(AuditLog)

        if date_from:
            try:
                dt = datetime.fromisoformat(date_from)
                q = q.filter(AuditLog.created_at >= dt)
                count_q = count_q.filter(AuditLog.created_at >= dt)
            except ValueError:
                pass

        if date_to:
            try:
                dt = datetime.fromisoformat(date_to)
                q = q.filter(AuditLog.created_at <= dt)
                count_q = count_q.filter(AuditLog.created_at <= dt)
            except ValueError:
                pass

        if entity_type:
            q = q.filter(AuditLog.entity_type == entity_type)
            count_q = count_q.filter(AuditLog.entity_type == entity_type)

        if action:
            q = q.filter(AuditLog.action == action)
            count_q = count_q.filter(AuditLog.action == action)

        total = count_q.scalar() or 0
        items = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

        return PaginatedAuditLogs(
            items=[AdminAuditLogItem.model_validate(i) for i in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    return await run_in_threadpool(_query)


@router.delete("/audit-logs/by-ids", response_model=BulkDeleteResult)
async def delete_audit_logs_by_ids(
    data: BulkDeleteByIds,
    db: Session = Depends(get_db),
):
    """Secili audit loglarini ID listesi ile sil."""

    def _delete():
        count = db.query(AuditLog).filter(AuditLog.id.in_(data.ids)).delete(synchronize_session=False)
        db.commit()
        logger.info("Audit log silindi: %d kayit (ID bazli)", count)
        return BulkDeleteResult(deleted_count=count, message=f"{count} audit log kaydi silindi")

    return await run_in_threadpool(_delete)


@router.delete("/audit-logs/by-date", response_model=BulkDeleteResult)
async def delete_audit_logs_by_date(
    data: BulkDeleteByDate,
    db: Session = Depends(get_db),
):
    """Belirtilen tarihten onceki tum audit loglari sil."""

    def _delete():
        count = db.query(AuditLog).filter(AuditLog.created_at < data.date_before).delete(synchronize_session=False)
        db.commit()
        logger.info("Audit log silindi: %d kayit (tarih bazli, oncesi: %s)", count, data.date_before)
        return BulkDeleteResult(deleted_count=count, message=f"{count} audit log kaydi silindi ({data.date_before} oncesi)")

    return await run_in_threadpool(_delete)


# ---- Execution Logs ----

@router.get("/execution-logs", response_model=PaginatedExecutionLogs)
async def list_execution_logs(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    level: Optional[str] = None,
    execution_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Filtrelenebilir execution log listesi."""

    def _query():
        q = db.query(ExecutionLog)
        count_q = db.query(func.count()).select_from(ExecutionLog)

        if date_from:
            try:
                dt = datetime.fromisoformat(date_from)
                q = q.filter(ExecutionLog.created_at >= dt)
                count_q = count_q.filter(ExecutionLog.created_at >= dt)
            except ValueError:
                pass

        if date_to:
            try:
                dt = datetime.fromisoformat(date_to)
                q = q.filter(ExecutionLog.created_at <= dt)
                count_q = count_q.filter(ExecutionLog.created_at <= dt)
            except ValueError:
                pass

        if level:
            q = q.filter(ExecutionLog.level == level)
            count_q = count_q.filter(ExecutionLog.level == level)

        if execution_id:
            q = q.filter(ExecutionLog.execution_id == execution_id)
            count_q = count_q.filter(ExecutionLog.execution_id == execution_id)

        total = count_q.scalar() or 0
        items = q.order_by(ExecutionLog.created_at.desc()).offset(offset).limit(limit).all()

        return PaginatedExecutionLogs(
            items=[AdminExecutionLogItem.model_validate(i) for i in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    return await run_in_threadpool(_query)


@router.delete("/execution-logs/by-ids", response_model=BulkDeleteResult)
async def delete_execution_logs_by_ids(
    data: BulkDeleteByIds,
    db: Session = Depends(get_db),
):
    """Secili execution loglarini ID listesi ile sil."""

    def _delete():
        count = db.query(ExecutionLog).filter(ExecutionLog.id.in_(data.ids)).delete(synchronize_session=False)
        db.commit()
        logger.info("Execution log silindi: %d kayit (ID bazli)", count)
        return BulkDeleteResult(deleted_count=count, message=f"{count} execution log kaydi silindi")

    return await run_in_threadpool(_delete)


@router.delete("/execution-logs/by-date", response_model=BulkDeleteResult)
async def delete_execution_logs_by_date(
    data: BulkDeleteByDate,
    db: Session = Depends(get_db),
):
    """Belirtilen tarihten onceki tum execution loglari sil."""

    def _delete():
        count = db.query(ExecutionLog).filter(ExecutionLog.created_at < data.date_before).delete(synchronize_session=False)
        db.commit()
        logger.info("Execution log silindi: %d kayit (tarih bazli, oncesi: %s)", count, data.date_before)
        return BulkDeleteResult(deleted_count=count, message=f"{count} execution log kaydi silindi ({data.date_before} oncesi)")

    return await run_in_threadpool(_delete)


# ---- Executions ----

@router.get("/executions", response_model=PaginatedExecutions)
async def list_executions(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Filtrelenebilir execution listesi (workflow adi dahil)."""

    def _query():
        q = db.query(Execution)
        count_q = db.query(func.count()).select_from(Execution)

        if date_from:
            try:
                dt = datetime.fromisoformat(date_from)
                q = q.filter(Execution.created_at >= dt)
                count_q = count_q.filter(Execution.created_at >= dt)
            except ValueError:
                pass

        if date_to:
            try:
                dt = datetime.fromisoformat(date_to)
                q = q.filter(Execution.created_at <= dt)
                count_q = count_q.filter(Execution.created_at <= dt)
            except ValueError:
                pass

        if status:
            q = q.filter(Execution.status == status)
            count_q = count_q.filter(Execution.status == status)

        total = count_q.scalar() or 0
        items = q.order_by(Execution.created_at.desc()).offset(offset).limit(limit).all()

        # Workflow adlarini cek
        wf_ids = {e.workflow_id for e in items}
        wf_map: dict[str, str] = {}
        if wf_ids:
            wfs = db.query(Workflow.id, Workflow.name).filter(Workflow.id.in_(wf_ids)).all()
            wf_map = {w.id: w.name for w in wfs}

        result_items = []
        for e in items:
            item = AdminExecutionItem.model_validate(e)
            item.workflow_name = wf_map.get(e.workflow_id)
            result_items.append(item)

        return PaginatedExecutions(
            items=result_items,
            total=total,
            limit=limit,
            offset=offset,
        )

    return await run_in_threadpool(_query)


@router.delete("/executions/by-ids", response_model=BulkDeleteResult)
async def delete_executions_by_ids(
    data: BulkDeleteByStringIds,
    db: Session = Depends(get_db),
):
    """Secili executionlari ID listesi ile sil (cascade: execution_logs da silinir)."""

    def _delete():
        # Once execution loglari sil (cascade yerine manuel — SQLAlchemy bulk delete cascade desteklemez)
        db.query(ExecutionLog).filter(ExecutionLog.execution_id.in_(data.ids)).delete(synchronize_session=False)
        count = db.query(Execution).filter(Execution.id.in_(data.ids)).delete(synchronize_session=False)
        db.commit()
        logger.info("Execution silindi: %d kayit (ID bazli, loglar dahil)", count)
        return BulkDeleteResult(deleted_count=count, message=f"{count} execution ve iliskili loglar silindi")

    return await run_in_threadpool(_delete)


@router.delete("/executions/by-date", response_model=BulkDeleteResult)
async def delete_executions_by_date(
    data: BulkDeleteByDate,
    db: Session = Depends(get_db),
):
    """Belirtilen tarihten onceki tum executionlari sil (cascade: execution_logs da silinir)."""

    def _delete():
        # Silinecek execution ID'lerini bul
        exec_ids = [
            e.id for e in
            db.query(Execution.id).filter(Execution.created_at < data.date_before).all()
        ]

        if exec_ids:
            db.query(ExecutionLog).filter(ExecutionLog.execution_id.in_(exec_ids)).delete(synchronize_session=False)
            count = db.query(Execution).filter(Execution.id.in_(exec_ids)).delete(synchronize_session=False)
        else:
            count = 0

        db.commit()
        logger.info("Execution silindi: %d kayit (tarih bazli, oncesi: %s)", count, data.date_before)
        return BulkDeleteResult(deleted_count=count, message=f"{count} execution ve iliskili loglar silindi ({data.date_before} oncesi)")

    return await run_in_threadpool(_delete)
