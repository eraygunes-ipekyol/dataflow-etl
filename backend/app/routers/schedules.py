from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.schedule import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from app.services import audit_service, schedule_service
from app.utils.auth_deps import get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/schedules", tags=["schedules"], dependencies=[Depends(get_current_user)])


def _get_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(workflow_id: Optional[str] = None, db: Session = Depends(get_db)):
    return await run_in_threadpool(schedule_service.list_schedules, db, workflow_id)


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(
    data: ScheduleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        schedule = await run_in_threadpool(schedule_service.create_schedule, db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "create", "schedule",
        schedule.id, schedule.name,
        None, {"cron": schedule.cron_expression, "workflow_id": schedule.workflow_id},
        _get_ip(request),
    )
    return schedule


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: str, db: Session = Depends(get_db)):
    schedule = await run_in_threadpool(schedule_service.get_schedule, db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule bulunamadı")
    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = await run_in_threadpool(schedule_service.get_schedule, db, schedule_id)
    old_value = {"cron": old.cron_expression, "is_active": old.is_active} if old else None

    schedule = await run_in_threadpool(schedule_service.update_schedule, db, schedule_id, data)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule bulunamadı")

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "update", "schedule",
        schedule_id, schedule.name,
        old_value, {"cron": schedule.cron_expression, "is_active": schedule.is_active},
        _get_ip(request),
    )
    return schedule


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = await run_in_threadpool(schedule_service.get_schedule, db, schedule_id)
    name = old.name if old else schedule_id

    ok = await run_in_threadpool(schedule_service.delete_schedule, db, schedule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Schedule bulunamadı")

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "delete", "schedule",
        schedule_id, name,
        None, None, _get_ip(request),
    )
