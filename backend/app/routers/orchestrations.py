"""
Orkestrasyon API router'ı.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.orchestration import (
    OrchestrationCreate,
    OrchestrationResponse,
    OrchestrationRunResult,
    OrchestrationUpdate,
)
from app.services import orchestration_service

router = APIRouter(prefix="/orchestrations", tags=["orchestrations"])


@router.get("", response_model=list[OrchestrationResponse])
def list_orchestrations(db: Session = Depends(get_db)):
    return orchestration_service.list_orchestrations(db)


@router.get("/{orchestration_id}", response_model=OrchestrationResponse)
def get_orchestration(orchestration_id: str, db: Session = Depends(get_db)):
    orch = orchestration_service.get_orchestration(db, orchestration_id)
    if not orch:
        raise HTTPException(status_code=404, detail="Orkestrasyon bulunamadı")
    return orch


@router.post("", response_model=OrchestrationResponse, status_code=201)
def create_orchestration(data: OrchestrationCreate, db: Session = Depends(get_db)):
    return orchestration_service.create_orchestration(db, data)


@router.put("/{orchestration_id}", response_model=OrchestrationResponse)
def update_orchestration(
    orchestration_id: str,
    data: OrchestrationUpdate,
    db: Session = Depends(get_db),
):
    orch = orchestration_service.update_orchestration(db, orchestration_id, data)
    if not orch:
        raise HTTPException(status_code=404, detail="Orkestrasyon bulunamadı")
    return orch


@router.delete("/{orchestration_id}", status_code=204)
def delete_orchestration(orchestration_id: str, db: Session = Depends(get_db)):
    ok = orchestration_service.delete_orchestration(db, orchestration_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Orkestrasyon bulunamadı")


@router.post("/{orchestration_id}/run", response_model=OrchestrationRunResult)
def run_orchestration(orchestration_id: str, db: Session = Depends(get_db)):
    """Manuel olarak orkestrasyon çalıştırır."""
    try:
        return orchestration_service.run_orchestration_now(db, orchestration_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{orchestration_id}/toggle", response_model=OrchestrationResponse)
def toggle_orchestration(orchestration_id: str, db: Session = Depends(get_db)):
    """Aktif/pasif geçiş yapar."""
    orch = orchestration_service.get_orchestration(db, orchestration_id)
    if not orch:
        raise HTTPException(status_code=404, detail="Orkestrasyon bulunamadı")

    updated = orchestration_service.update_orchestration(
        db, orchestration_id,
        OrchestrationUpdate(is_active=not orch.is_active)
    )
    return updated
