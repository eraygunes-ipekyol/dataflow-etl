"""
Orkestrasyon API router'ı — audit log ile.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.orchestration import (
    OrchestrationCreate,
    OrchestrationResponse,
    OrchestrationRunResult,
    OrchestrationUpdate,
)
from app.services import audit_service, orchestration_service
from app.utils.auth_deps import get_current_user

router = APIRouter(prefix="/orchestrations", tags=["orchestrations"], dependencies=[Depends(get_current_user)])


def _get_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


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
def create_orchestration(
    data: OrchestrationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orch = orchestration_service.create_orchestration(db, data)
    audit_service.log_action(
        db,
        current_user.id, current_user.username,
        "create", "orchestration",
        orch.id, orch.name,
        None, {"cron": orch.cron_expression, "steps": len(orch.steps)},
        _get_ip(request),
    )
    return orch


@router.put("/{orchestration_id}", response_model=OrchestrationResponse)
def update_orchestration(
    orchestration_id: str,
    data: OrchestrationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = orchestration_service.get_orchestration(db, orchestration_id)
    old_value = {"name": old.name, "cron": old.cron_expression, "steps": len(old.steps)} if old else None

    orch = orchestration_service.update_orchestration(db, orchestration_id, data)
    if not orch:
        raise HTTPException(status_code=404, detail="Orkestrasyon bulunamadı")

    audit_service.log_action(
        db,
        current_user.id, current_user.username,
        "update", "orchestration",
        orchestration_id, orch.name,
        old_value, {"cron": orch.cron_expression, "steps": len(orch.steps)},
        _get_ip(request),
    )
    return orch


@router.delete("/{orchestration_id}", status_code=204)
def delete_orchestration(
    orchestration_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = orchestration_service.get_orchestration(db, orchestration_id)
    name = old.name if old else orchestration_id

    ok = orchestration_service.delete_orchestration(db, orchestration_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Orkestrasyon bulunamadı")

    audit_service.log_action(
        db,
        current_user.id, current_user.username,
        "delete", "orchestration",
        orchestration_id, name,
        None, None, _get_ip(request),
    )


@router.post("/{orchestration_id}/run", response_model=OrchestrationRunResult)
def run_orchestration(orchestration_id: str, db: Session = Depends(get_db)):
    """Manuel olarak orkestrasyon çalıştırır."""
    try:
        return orchestration_service.run_orchestration_now(db, orchestration_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{orchestration_id}/toggle", response_model=OrchestrationResponse)
def toggle_orchestration(
    orchestration_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aktif/pasif geçiş yapar."""
    orch = orchestration_service.get_orchestration(db, orchestration_id)
    if not orch:
        raise HTTPException(status_code=404, detail="Orkestrasyon bulunamadı")

    updated = orchestration_service.update_orchestration(
        db, orchestration_id,
        OrchestrationUpdate(is_active=not orch.is_active)
    )

    audit_service.log_action(
        db,
        current_user.id, current_user.username,
        "update", "orchestration",
        orchestration_id, updated.name,
        {"is_active": orch.is_active},
        {"is_active": updated.is_active},
        _get_ip(request),
    )
    return updated
