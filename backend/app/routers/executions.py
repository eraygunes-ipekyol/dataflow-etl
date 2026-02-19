from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.schemas.execution import ExecutionDetail, ExecutionLogResponse, ExecutionResponse
from app.services import execution_service
from app.utils.logger import logger
from app.utils.auth_deps import get_current_user

router = APIRouter(prefix="/executions", tags=["executions"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ExecutionResponse])
async def list_executions(
    workflow_id: Optional[str] = None,
    date_from: Optional[str] = None,   # ISO date string: 2024-01-15
    date_to: Optional[str] = None,     # ISO date string: 2024-01-20
    status: Optional[str] = None,      # success|failed|running|pending
    limit: int = 200,
    db: Session = Depends(get_db),
):
    rows = await run_in_threadpool(
        execution_service.list_executions, db, workflow_id, date_from, date_to, status, limit
    )
    return [ExecutionResponse.model_validate(r) for r in rows]


@router.get("/{execution_id}", response_model=ExecutionDetail)
async def get_execution(execution_id: str, db: Session = Depends(get_db)):
    execution = await run_in_threadpool(execution_service.get_execution, db, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution bulunamadı")
    logs = await run_in_threadpool(execution_service.get_execution_logs, db, execution_id)
    return ExecutionDetail(
        **ExecutionResponse.model_validate(execution).model_dump(),
        logs=[ExecutionLogResponse.model_validate(log) for log in logs],
    )


@router.get("/{execution_id}/logs", response_model=list[ExecutionLogResponse])
async def get_execution_logs(execution_id: str, db: Session = Depends(get_db)):
    return await run_in_threadpool(execution_service.get_execution_logs, db, execution_id)


@router.post("/{execution_id}/cancel", status_code=204)
async def cancel_execution(execution_id: str, db: Session = Depends(get_db)):
    ok = await run_in_threadpool(execution_service.cancel_execution, db, execution_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Execution iptal edilemedi")


# ─── Workflow tetikleyici ──────────────────────────────────────────────────

def _run_workflow_task(workflow_id: str, execution_id: str, trigger_type: str):
    """Background task: kendi DB session'ını açar ve kapatır."""
    db = SessionLocal()
    try:
        execution_service.run_workflow(db, workflow_id, trigger_type, execution_id=execution_id)
    except Exception as e:
        logger.error(f"Workflow çalıştırma hatası [{workflow_id}]: {e}")
    finally:
        db.close()


@router.post("/run/{workflow_id}", response_model=ExecutionResponse, status_code=202)
async def run_workflow(
    workflow_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Workflow'u arka planda başlatır, hemen gerçek execution kaydını döner."""
    from app.models.workflow import Workflow
    from app.models.execution import Execution

    workflow = await run_in_threadpool(db.get, Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")

    execution_id = uuid.uuid4().hex

    def _create_execution():
        execution = Execution(
            id=execution_id,
            workflow_id=workflow_id,
            status="pending",
            trigger_type="manual",
            started_at=datetime.now(timezone.utc),
        )
        db.add(execution)
        db.commit()
        db.refresh(execution)
        return execution

    execution = await run_in_threadpool(_create_execution)
    background_tasks.add_task(_run_workflow_task, workflow_id, execution_id, "manual")

    return ExecutionResponse.model_validate(execution)


# ─── WebSocket: canlı log akışı ───────────────────────────────────────────

@router.websocket("/ws/{execution_id}/logs")
async def ws_execution_logs(
    websocket: WebSocket,
    execution_id: str,
):
    """
    Belirli bir execution için yeni log satırlarını canlı gönderir.
    DB sorguları thread pool'da çalışır — event loop bloke olmaz.
    """
    await websocket.accept()
    last_log_id = 0
    try:
        while True:
            def _fetch_logs(last_id: int):
                db = SessionLocal()
                try:
                    execution = execution_service.get_execution(db, execution_id)
                    if not execution:
                        return None, None, None, None

                    from app.models.execution import ExecutionLog
                    new_logs = (
                        db.query(ExecutionLog)
                        .filter(
                            ExecutionLog.execution_id == execution_id,
                            ExecutionLog.id > last_id,
                        )
                        .order_by(ExecutionLog.id)
                        .all()
                    )
                    log_data = [
                        {
                            "id": log.id,
                            "node_id": log.node_id,
                            "level": log.level,
                            "message": log.message,
                            "created_at": log.created_at.isoformat(),
                        }
                        for log in new_logs
                    ]
                    return log_data, execution.status, execution.rows_processed, execution.rows_failed
                finally:
                    db.close()

            log_data, current_status, rows_processed, rows_failed = await run_in_threadpool(
                _fetch_logs, last_log_id
            )

            if current_status is None:
                await websocket.send_json({"error": "Execution bulunamadı"})
                break

            for log_item in log_data:
                await websocket.send_json(log_item)
                last_log_id = log_item["id"]

            if current_status in ("success", "failed", "cancelled"):
                await websocket.send_json({
                    "type": "done",
                    "status": current_status,
                    "rows_processed": rows_processed,
                    "rows_failed": rows_failed,
                })
                break

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket hatası [{execution_id}]: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
