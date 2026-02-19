from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schedule import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from app.services import schedule_service
from app.utils.logger import logger

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(workflow_id: Optional[str] = None, db: Session = Depends(get_db)):
    return await run_in_threadpool(schedule_service.list_schedules, db, workflow_id)


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(data: ScheduleCreate, db: Session = Depends(get_db)):
    try:
        return await run_in_threadpool(schedule_service.create_schedule, db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: str, db: Session = Depends(get_db)):
    schedule = await run_in_threadpool(schedule_service.get_schedule, db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule bulunamadı")
    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(schedule_id: str, data: ScheduleUpdate, db: Session = Depends(get_db)):
    schedule = await run_in_threadpool(schedule_service.update_schedule, db, schedule_id, data)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule bulunamadı")
    return schedule


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: str, db: Session = Depends(get_db)):
    ok = await run_in_threadpool(schedule_service.delete_schedule, db, schedule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Schedule bulunamadı")
