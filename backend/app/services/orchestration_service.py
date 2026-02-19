"""
Orkestrasyon servisi.
Birden fazla workflow'u sırayla çalıştırır, retry/timeout/on_failure destekler.
APScheduler ile cron bazlı zamanlama yapar.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session, sessionmaker

from app.models.orchestration import Orchestration, OrchestrationStep
from app.models.workflow import Workflow
from app.schemas.orchestration import (
    OrchestrationCreate,
    OrchestrationResponse,
    OrchestrationRunResult,
    OrchestrationStepResponse,
    OrchestrationUpdate,
)
from app.utils.logger import logger

# APScheduler — schedule_service'den paylaşımlı
_scheduler = None
_SessionLocal: Optional[sessionmaker] = None


def set_scheduler(scheduler, session_factory: sessionmaker) -> None:
    """main.py'den init sırasında çağrılır."""
    global _scheduler, _SessionLocal
    _scheduler = scheduler
    _SessionLocal = session_factory


# ─── Yardımcı ─────────────────────────────────────────────────────────────

def _step_to_response(step: OrchestrationStep) -> OrchestrationStepResponse:
    wf_name = step.workflow.name if step.workflow else None
    return OrchestrationStepResponse(
        id=step.id,
        orchestration_id=step.orchestration_id,
        workflow_id=step.workflow_id,
        order_index=step.order_index,
        retry_count=step.retry_count,
        retry_delay_seconds=step.retry_delay_seconds,
        timeout_seconds=step.timeout_seconds,
        on_failure=step.on_failure,
        workflow_name=wf_name,
    )


def _orch_to_response(orch: Orchestration) -> OrchestrationResponse:
    return OrchestrationResponse(
        id=orch.id,
        name=orch.name,
        description=orch.description,
        cron_expression=orch.cron_expression,
        is_active=orch.is_active,
        on_error=orch.on_error,
        last_run_at=orch.last_run_at,
        next_run_at=orch.next_run_at,
        created_at=orch.created_at,
        updated_at=orch.updated_at,
        steps=[_step_to_response(s) for s in orch.steps],
    )


# ─── APScheduler job ──────────────────────────────────────────────────────

def _run_orchestration_job(orchestration_id: str) -> None:
    """APScheduler tarafından tetiklenir. Sync çalışır."""
    if _SessionLocal is None:
        return
    db: Session = _SessionLocal()
    try:
        orch = db.get(Orchestration, orchestration_id)
        if not orch or not orch.is_active:
            return
        orch.last_run_at = datetime.now(timezone.utc)
        db.commit()

        logger.info("Orkestrasyon başlatıldı: %s (%s)", orch.name, orchestration_id)
        _execute_orchestration(db, orch)

        # next_run_at güncelle
        orch = db.get(Orchestration, orchestration_id)
        if orch and _scheduler:
            job = _scheduler.get_job(f"orch_{orchestration_id}")
            if job and job.next_run_time:
                orch.next_run_at = job.next_run_time
                db.commit()
    except Exception as e:
        logger.exception("Orkestrasyon job hatası: %s", e)
    finally:
        db.close()


def _execute_orchestration(db: Session, orch: Orchestration) -> OrchestrationRunResult:
    """
    Orkestrasyon adımlarını sırayla çalıştırır.
    retry_count, timeout_seconds, on_failure politikalarını uygular.
    """
    from app.services.execution_service import run_workflow

    steps = sorted(orch.steps, key=lambda s: s.order_index)
    total = len(steps)
    completed = 0
    failed = 0
    skipped = 0
    execution_ids: list[str] = []

    for step in steps:
        wf = db.get(Workflow, step.workflow_id)
        wf_name = wf.name if wf else step.workflow_id[:8]
        logger.info(
            "Orkestrasyon adımı: %s / %s — Workflow: %s",
            step.order_index + 1, total, wf_name
        )

        max_attempts = max(1, step.retry_count + 1)
        attempt = 0
        step_success = False
        last_exec_id = None

        while attempt < max_attempts:
            attempt += 1
            logger.info("Deneme %d/%d: %s", attempt, max_attempts, wf_name)

            try:
                # Timeout desteği — basit time-based (thread'de sync çalışıyor)
                start_time = time.time()
                exec_id = run_workflow(db, step.workflow_id, trigger_type="chained")
                elapsed = time.time() - start_time
                last_exec_id = exec_id

                # Timeout kontrolü
                if step.timeout_seconds > 0 and elapsed > step.timeout_seconds:
                    logger.warning(
                        "Adım zaman aşımı: %s (%.1fs > %ds)",
                        wf_name, elapsed, step.timeout_seconds
                    )
                    # Execution başarılı olmuş olabilir ama timeout'u geçti — failed say
                    raise TimeoutError(
                        f"Timeout: {elapsed:.1f}s > {step.timeout_seconds}s"
                    )

                # Execution durumunu kontrol et
                from app.models.execution import Execution
                exec_record = db.get(Execution, exec_id)
                if exec_record and exec_record.status == "failed":
                    raise RuntimeError(
                        f"Workflow başarısız: {exec_record.error_message or 'Bilinmeyen hata'}"
                    )

                step_success = True
                if exec_id:
                    execution_ids.append(exec_id)
                break  # Başarılı, döngüden çık

            except Exception as e:
                logger.warning("Deneme %d başarısız: %s — %s", attempt, wf_name, e)
                if last_exec_id:
                    execution_ids.append(last_exec_id)

                if attempt < max_attempts:
                    delay = step.retry_delay_seconds
                    if delay > 0:
                        logger.info("Yeniden denemeden önce %ds bekleniyor...", delay)
                        time.sleep(delay)

        if step_success:
            completed += 1
        else:
            failed += 1
            if step.on_failure == "stop":
                logger.warning(
                    "Adım başarısız ve on_failure=stop: orkestrasyon durduruluyor."
                )
                # Kalan adımları atla
                skipped = total - completed - failed
                break
            else:
                logger.info("Adım başarısız fakat on_failure=continue: devam ediliyor.")

    if failed == 0:
        overall = "success"
    elif completed > 0:
        overall = "partial"
    else:
        overall = "failed"

    result = OrchestrationRunResult(
        orchestration_id=orch.id,
        orchestration_name=orch.name,
        total_steps=total,
        completed_steps=completed,
        failed_steps=failed,
        skipped_steps=skipped,
        execution_ids=execution_ids,
        status=overall,
    )
    logger.info(
        "Orkestrasyon tamamlandı: %s — %s (%d/%d adım)",
        orch.name, overall, completed, total
    )
    return result


# ─── APScheduler kayıt ────────────────────────────────────────────────────

def _register_orchestration_job(orch: Orchestration) -> Optional[datetime]:
    if _scheduler is None or not orch.is_active:
        return None
    try:
        from apscheduler.triggers.cron import CronTrigger
        parts = orch.cron_expression.split()
        if len(parts) != 5:
            logger.warning("Geçersiz cron ifadesi: %s", orch.cron_expression)
            return None
        minute, hour, day, month, day_of_week = parts
        trigger = CronTrigger(
            minute=minute, hour=hour, day=day,
            month=month, day_of_week=day_of_week,
            timezone="Europe/Istanbul",
        )
        job_id = f"orch_{orch.id}"
        _scheduler.add_job(
            _run_orchestration_job,
            trigger=trigger,
            id=job_id,
            args=[orch.id],
            replace_existing=True,
        )
        job = _scheduler.get_job(job_id)
        if job and job.next_run_time:
            return job.next_run_time
    except Exception as e:
        logger.error("Orkestrasyon job kaydedilemedi: %s", e)
    return None


def _unregister_orchestration_job(orchestration_id: str) -> None:
    if _scheduler:
        job_id = f"orch_{orchestration_id}"
        if _scheduler.get_job(job_id):
            _scheduler.remove_job(job_id)


# ─── CRUD ─────────────────────────────────────────────────────────────────

def list_orchestrations(db: Session) -> list[OrchestrationResponse]:
    orchs = (
        db.query(Orchestration)
        .order_by(Orchestration.created_at.desc())
        .all()
    )
    return [_orch_to_response(o) for o in orchs]


def get_orchestration(db: Session, orchestration_id: str) -> Optional[OrchestrationResponse]:
    orch = db.get(Orchestration, orchestration_id)
    if not orch:
        return None
    return _orch_to_response(orch)


def create_orchestration(db: Session, data: OrchestrationCreate) -> OrchestrationResponse:
    orch = Orchestration(
        name=data.name,
        description=data.description,
        cron_expression=data.cron_expression,
        is_active=data.is_active,
        on_error=data.on_error,
    )
    db.add(orch)
    db.flush()  # id üret

    for i, step_data in enumerate(data.steps):
        step = OrchestrationStep(
            orchestration_id=orch.id,
            workflow_id=step_data.workflow_id,
            order_index=step_data.order_index if step_data.order_index != 0 else i,
            retry_count=step_data.retry_count,
            retry_delay_seconds=step_data.retry_delay_seconds,
            timeout_seconds=step_data.timeout_seconds,
            on_failure=step_data.on_failure,
        )
        db.add(step)

    db.commit()
    db.refresh(orch)

    if orch.is_active:
        next_run = _register_orchestration_job(orch)
        if next_run:
            orch.next_run_at = next_run
            db.commit()

    return _orch_to_response(orch)


def update_orchestration(
    db: Session,
    orchestration_id: str,
    data: OrchestrationUpdate,
) -> Optional[OrchestrationResponse]:
    orch = db.get(Orchestration, orchestration_id)
    if not orch:
        return None

    if data.name is not None:
        orch.name = data.name
    if data.description is not None:
        orch.description = data.description
    if data.cron_expression is not None:
        orch.cron_expression = data.cron_expression
    if data.is_active is not None:
        orch.is_active = data.is_active
    if data.on_error is not None:
        orch.on_error = data.on_error

    # Adımları güncelle: steps verilmişse tümünü sil ve yeniden ekle
    if data.steps is not None:
        for step in list(orch.steps):
            db.delete(step)
        db.flush()
        for i, step_data in enumerate(data.steps):
            step = OrchestrationStep(
                orchestration_id=orch.id,
                workflow_id=step_data.workflow_id,
                order_index=step_data.order_index if step_data.order_index != 0 else i,
                retry_count=step_data.retry_count,
                retry_delay_seconds=step_data.retry_delay_seconds,
                timeout_seconds=step_data.timeout_seconds,
                on_failure=step_data.on_failure,
            )
            db.add(step)

    db.commit()
    db.refresh(orch)

    # APScheduler güncelle
    _unregister_orchestration_job(orchestration_id)
    if orch.is_active:
        next_run = _register_orchestration_job(orch)
        orch.next_run_at = next_run
    else:
        orch.next_run_at = None
    db.commit()

    return _orch_to_response(orch)


def delete_orchestration(db: Session, orchestration_id: str) -> bool:
    orch = db.get(Orchestration, orchestration_id)
    if not orch:
        return False
    _unregister_orchestration_job(orchestration_id)
    db.delete(orch)
    db.commit()
    return True


def run_orchestration_now(db: Session, orchestration_id: str) -> OrchestrationRunResult:
    """Manuel tetikleme."""
    orch = db.get(Orchestration, orchestration_id)
    if not orch:
        raise ValueError(f"Orkestrasyon bulunamadı: {orchestration_id}")
    orch.last_run_at = datetime.now(timezone.utc)
    db.commit()
    return _execute_orchestration(db, orch)


def load_all_orchestrations(db: Session) -> None:
    """Uygulama başlangıcında aktif orkestrasyon job'larını APScheduler'a yükler."""
    orchs = db.query(Orchestration).filter(Orchestration.is_active == True).all()  # noqa: E712
    for orch in orchs:
        _register_orchestration_job(orch)
    logger.info("%d aktif orkestrasyon yüklendi", len(orchs))
