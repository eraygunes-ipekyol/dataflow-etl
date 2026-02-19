import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowDetail,
    WorkflowResponse,
    WorkflowUpdate,
    WorkflowValidationResult,
)
from app.services import audit_service, workflow_service
from app.utils.auth_deps import get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/workflows", tags=["workflows"], dependencies=[Depends(get_current_user)])


def _get_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(folder_id: Optional[str] = None, db: Session = Depends(get_db)):
    return await run_in_threadpool(workflow_service.list_workflows, db, folder_id)


@router.post("", response_model=WorkflowResponse, status_code=201)
async def create_workflow(
    data: WorkflowCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        workflow = await run_in_threadpool(workflow_service.create_workflow, db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "create", "workflow",
        workflow.id, workflow.name,
        None,
        {"name": workflow.name, "folder_id": workflow.folder_id},
        _get_ip(request),
    )
    return workflow


@router.get("/{workflow_id}", response_model=WorkflowDetail)
async def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    workflow = await run_in_threadpool(workflow_service.get_workflow, db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")

    return WorkflowDetail(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        folder_id=workflow.folder_id,
        version=workflow.version,
        is_active=workflow.is_active,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        definition=json.loads(workflow.definition),
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    data: WorkflowUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Güncelleme öncesi eski definition'ı al (restore için)
    old_wf = await run_in_threadpool(workflow_service.get_workflow, db, workflow_id)
    old_value = None
    if old_wf:
        try:
            old_value = {
                "name": old_wf.name,
                "definition": json.loads(old_wf.definition),
                "version": old_wf.version,
            }
        except Exception:
            old_value = {"name": old_wf.name}

    workflow = await run_in_threadpool(workflow_service.update_workflow, db, workflow_id, data)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")

    new_value = {"name": workflow.name, "version": workflow.version}
    if data.definition is not None:
        new_value["definition"] = data.definition

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "update", "workflow",
        workflow_id, workflow.name,
        old_value, new_value,
        _get_ip(request),
    )
    return workflow


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(
    workflow_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old_wf = await run_in_threadpool(workflow_service.get_workflow, db, workflow_id)
    wf_name = old_wf.name if old_wf else workflow_id

    ok = await run_in_threadpool(workflow_service.delete_workflow, db, workflow_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "delete", "workflow",
        workflow_id, wf_name,
        None, None,
        _get_ip(request),
    )


@router.post("/{workflow_id}/validate", response_model=WorkflowValidationResult)
async def validate_workflow(workflow_id: str, db: Session = Depends(get_db)):
    try:
        return await run_in_threadpool(workflow_service.validate_workflow, db, workflow_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workflow_id}/export")
async def export_workflow(workflow_id: str, db: Session = Depends(get_db)):
    data = await run_in_threadpool(workflow_service.export_workflow, db, workflow_id)
    if not data:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")

    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f'attachment; filename="workflow_{workflow_id}.json"'},
    )


@router.post("/import", response_model=WorkflowResponse, status_code=201)
async def import_workflow(
    file: UploadFile,
    request: Request,
    folder_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        content = await file.read()
        data = json.loads(content)
        workflow = await run_in_threadpool(workflow_service.import_workflow, db, data, folder_id)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Geçersiz JSON dosyası")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "create", "workflow",
        workflow.id, workflow.name,
        None, {"name": workflow.name, "imported": True},
        _get_ip(request),
    )
    return workflow


# ─── Workflow Geçmişi + Restore ───────────────────────────────────────────

@router.get("/{workflow_id}/history", response_model=list[AuditLogResponse])
async def get_workflow_history(workflow_id: str, db: Session = Depends(get_db)):
    """Workflow'a ait değişiklik geçmişini döner (versiyonlama)."""
    logs = await run_in_threadpool(audit_service.get_workflow_history, db, workflow_id)
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.post("/{workflow_id}/restore/{audit_log_id}", response_model=WorkflowResponse)
async def restore_workflow(
    workflow_id: str,
    audit_log_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Workflow'u belirtilen audit log kaydındaki eski haline geri yükler."""
    from app.models.audit_log import AuditLog

    log_entry = db.get(AuditLog, audit_log_id)
    if not log_entry or log_entry.entity_id != workflow_id:
        raise HTTPException(status_code=404, detail="Geçmiş kaydı bulunamadı")

    if not log_entry.old_value:
        raise HTTPException(status_code=400, detail="Bu kayıtta geri yüklenecek veri yok")

    try:
        old_data = json.loads(log_entry.old_value) if isinstance(log_entry.old_value, str) else log_entry.old_value
        old_definition = old_data.get("definition")
        if old_definition is None:
            raise HTTPException(status_code=400, detail="Bu kayıtta workflow tanımı yok")
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Geçmiş verisi okunamadı: {e}")

    # Mevcut workflow'u al (restore öncesi)
    current_wf = await run_in_threadpool(workflow_service.get_workflow, db, workflow_id)
    current_value = None
    if current_wf:
        try:
            current_value = {
                "name": current_wf.name,
                "definition": json.loads(current_wf.definition),
                "version": current_wf.version,
            }
        except Exception:
            current_value = {"name": current_wf.name}

    # Definition'ı geri yükle
    update_data = WorkflowUpdate(definition=old_definition)
    workflow = await run_in_threadpool(workflow_service.update_workflow, db, workflow_id, update_data)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")

    # Restore audit log
    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "restore", "workflow",
        workflow_id, workflow.name,
        current_value,
        {"restored_from_log_id": audit_log_id, "version": workflow.version},
        _get_ip(request),
    )

    logger.info("Workflow restore: %s → log %d by %s", workflow_id, audit_log_id, current_user.username)
    return workflow
