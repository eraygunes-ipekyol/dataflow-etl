import asyncio
import time
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import create_tables
from app.database import SessionLocal
from app.routers import auth, audit_logs, connections, data_preview, executions, folders, health, orchestrations, schedules, workflows
from app.services import orchestration_service, schedule_service
from app.services.auth_service import ensure_default_admin
from app.utils.logger import logger

REQUEST_TIMEOUT_SECONDS = 60  # Herhangi bir istek için maksimum süre


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("DataFlow ETL başlatılıyor...")
    create_tables()
    logger.info("Veritabanı tabloları hazır.")
    scheduler = schedule_service.init_scheduler(SessionLocal)
    orchestration_service.set_scheduler(scheduler, SessionLocal)
    db = SessionLocal()
    try:
        ensure_default_admin(db)
        schedule_service.load_all_schedules(db)
        orchestration_service.load_all_orchestrations(db)
    finally:
        db.close()
    yield
    schedule_service.shutdown_scheduler()
    logger.info("DataFlow ETL kapatılıyor...")


app = FastAPI(
    title="DataFlow ETL",
    description="Browser tabanlı ETL aracı - MSSQL ve BigQuery veri aktarımı",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Yakalanmayan tüm hatalar için güvenli 500 yanıtı döner - sunucu çökmez."""
    tb = traceback.format_exc()
    logger.error(f"Yakalanmayan hata [{request.method} {request.url.path}]: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Sunucu hatası: {type(exc).__name__}: {str(exc)}"},
    )


# ── Request Timeout Middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    """Her isteğe REQUEST_TIMEOUT_SECONDS saniyelik timeout uygular."""
    start = time.time()
    try:
        return await asyncio.wait_for(call_next(request), timeout=REQUEST_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        elapsed = time.time() - start
        logger.warning(
            f"Request timeout [{request.method} {request.url.path}] "
            f"{elapsed:.1f}s > {REQUEST_TIMEOUT_SECONDS}s"
        )
        return JSONResponse(
            status_code=504,
            content={
                "detail": (
                    f"İstek zaman aşımına uğradı ({REQUEST_TIMEOUT_SECONDS}s). "
                    "Bağlantı yavaş veya sorgu çok uzun sürdü."
                )
            },
        )
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error(f"Middleware hatası [{request.method} {request.url.path}]: {exc}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Sunucu hatası: {type(exc).__name__}: {str(exc)}"},
        )


# ── Request Logging Middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Yavaş istekleri loglar (>5s)."""
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    if elapsed > 5:
        logger.warning(
            f"Yavaş istek [{request.method} {request.url.path}] "
            f"{elapsed:.2f}s — status={response.status_code}"
        )
    return response


app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(audit_logs.router, prefix="/api/v1")
app.include_router(connections.router, prefix="/api/v1")
app.include_router(data_preview.router, prefix="/api/v1")
app.include_router(workflows.router, prefix="/api/v1")
app.include_router(folders.router, prefix="/api/v1")
app.include_router(executions.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(orchestrations.router, prefix="/api/v1")
