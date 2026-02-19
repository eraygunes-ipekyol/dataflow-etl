import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowDetail,
    WorkflowResponse,
    WorkflowUpdate,
    WorkflowValidationResult,
)
from app.services import workflow_service
from app.utils.logger import logger

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(folder_id: Optional[str] = None, db: Session = Depends(get_db)):
    return await run_in_threadpool(workflow_service.list_workflows, db, folder_id)


@router.post("", response_model=WorkflowResponse, status_code=201)
async def create_workflow(data: WorkflowCreate, db: Session = Depends(get_db)):
    try:
        return await run_in_threadpool(workflow_service.create_workflow, db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
async def update_workflow(workflow_id: str, data: WorkflowUpdate, db: Session = Depends(get_db)):
    workflow = await run_in_threadpool(workflow_service.update_workflow, db, workflow_id, data)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")
    return workflow


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: str, db: Session = Depends(get_db)):
    ok = await run_in_threadpool(workflow_service.delete_workflow, db, workflow_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workflow bulunamadı")


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
    folder_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    try:
        content = await file.read()
        data = json.loads(content)
        workflow = await run_in_threadpool(workflow_service.import_workflow, db, data, folder_id)
        return workflow
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Geçersiz JSON dosyası")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
