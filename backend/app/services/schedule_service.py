"""
Zamanlayıcı servisi.
APScheduler kullanarak cron tabanlı workflow çalıştırma.
"""
from __future__ import annotations

from datetime import timezone
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session, sessionmaker

from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate
from app.utils.logger import logger

# Global scheduler instance
_scheduler: Optional[BackgroundScheduler] = None
_SessionLocal: Optional[sessionmaker] = None


def init_scheduler(session_factory: sessionmaker) -> BackgroundScheduler:
    """Uygulama başlangıcında bir kez çağrılır."""
    global _scheduler, _SessionLocal
    _SessionLocal = session_factory
    _scheduler = BackgroundScheduler(timezone="Europe/Istanbul")
    _scheduler.start()
    logger.info("Scheduler başlatıldı")
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler durduruldu")


# ─── APScheduler job callback ─────────────────────────────────────────────

def _run_scheduled_workflow(schedule_id: str, workflow_id: str) -> None:
    """APScheduler tarafından çağrılır - sync çalışır."""
    if _SessionLocal is None:
        return

    from datetime import datetime
    from app.services import execution_service

    db: Session = _SessionLocal()
    try:
        logger.info("Zamanlanmış çalıştırma: schedule=%s workflow=%s", schedule_id, workflow_id)
        schedule = db.get(Schedule, schedule_id)
        if schedule:
            schedule.last_run_at = datetime.now(timezone.utc)
            db.commit()

        execution_service.run_workflow(db, workflow_id, trigger_type="scheduled")

        # next_run_at güncelle
        schedule = db.get(Schedule, schedule_id)
        if schedule and _scheduler:
            job = _scheduler.get_job(schedule_id)
            if job and job.next_run_time:
                schedule.next_run_at = job.next_run_time
                db.commit()
    except Exception as e:
        logger.exception("Zamanlanmış çalıştırma hatası: %s", e)
    finally:
        db.close()


# ─── Schedule CRUD ────────────────────────────────────────────────────────

def _register_job(schedule: Schedule) -> None:
    """Aktif schedule'ı APScheduler'a ekler."""
    if _scheduler is None or not schedule.is_active:
        return
    try:
        parts = schedule.cron_expression.split()
        if len(parts) == 5:
            minute, hour, day, month, day_of_week = parts
        else:
            logger.warning("Geçersiz cron ifadesi: %s", schedule.cron_expression)
            return

        trigger = CronTrigger(
            minute=minute, hour=hour, day=day,
            month=month, day_of_week=day_of_week,
            timezone="Europe/Istanbul",
        )
        _scheduler.add_job(
            _run_scheduled_workflow,
            trigger=trigger,
            id=schedule.id,
            args=[schedule.id, schedule.workflow_id],
            replace_existing=True,
        )
        job = _scheduler.get_job(schedule.id)
        if job and job.next_run_time:
            return job.next_run_time
    except Exception as e:
        logger.error("Job kaydedilemedi: %s", e)
    return None


def _unregister_job(schedule_id: str) -> None:
    if _scheduler and _scheduler.get_job(schedule_id):
        _scheduler.remove_job(schedule_id)


def list_schedules(db: Session, workflow_id: Optional[str] = None) -> list[Schedule]:
    q = db.query(Schedule)
    if workflow_id:
        q = q.filter(Schedule.workflow_id == workflow_id)
    return q.order_by(Schedule.created_at.desc()).all()


def get_schedule(db: Session, schedule_id: str) -> Optional[Schedule]:
    return db.get(Schedule, schedule_id)


def create_schedule(db: Session, data: ScheduleCreate) -> Schedule:
    from datetime import datetime

    schedule = Schedule(
        workflow_id=data.workflow_id,
        name=data.name,
        cron_expression=data.cron_expression,
        is_active=data.is_active,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    if schedule.is_active:
        next_run = _register_job(schedule)
        if next_run:
            schedule.next_run_at = next_run
            db.commit()

    return schedule


def update_schedule(db: Session, schedule_id: str, data: ScheduleUpdate) -> Optional[Schedule]:
    schedule = db.get(Schedule, schedule_id)
    if not schedule:
        return None

    if data.name is not None:
        schedule.name = data.name
    if data.cron_expression is not None:
        schedule.cron_expression = data.cron_expression
    if data.is_active is not None:
        schedule.is_active = data.is_active

    db.commit()
    db.refresh(schedule)

    # APScheduler'ı güncelle
    _unregister_job(schedule_id)
    if schedule.is_active:
        next_run = _register_job(schedule)
        if next_run:
            schedule.next_run_at = next_run
            db.commit()
    else:
        schedule.next_run_at = None
        db.commit()

    return schedule


def delete_schedule(db: Session, schedule_id: str) -> bool:
    schedule = db.get(Schedule, schedule_id)
    if not schedule:
        return False
    _unregister_job(schedule_id)
    db.delete(schedule)
    db.commit()
    return True


def load_all_schedules(db: Session) -> None:
    """Uygulama başlangıcında aktif schedule'ları APScheduler'a yükler."""
    schedules = db.query(Schedule).filter(Schedule.is_active == True).all()  # noqa: E712
    for schedule in schedules:
        _register_job(schedule)
    logger.info("%d aktif schedule yüklendi", len(schedules))
