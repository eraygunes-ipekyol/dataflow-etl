import time
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import ensure_jwt_secret, settings
from app.database import create_tables
from app.database import SessionLocal
from app.routers import admin, ai, auth, audit_logs, connections, data_preview, executions, folders, health, orchestrations, schedules, workflows
from app.services import orchestration_service, schedule_service
from app.services.auth_service import ensure_default_admin
from app.utils.logger import logger

REQUEST_TIMEOUT_SECONDS = 120  # Herhangi bir istek için maksimum süre (long-running ETL'ler için)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("EROS - ETL başlatılıyor...")
    ensure_jwt_secret()
    create_tables()

    # Mevcut DB'ye must_change_password sütunu eklenmemişse ekle (Alembic yok)
    from sqlalchemy import inspect as sa_inspect, text
    from app.database import engine
    inspector = sa_inspect(engine)
    existing_cols = [c["name"] for c in inspector.get_columns("users")]
    if "must_change_password" not in existing_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        logger.info("users tablosuna must_change_password sütunu eklendi.")

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
    logger.info("EROS - ETL kapatılıyor...")


app = FastAPI(
    title="EROS - ETL",
    description="Browser tabanlı ETL aracı - MSSQL ve BigQuery veri aktarımı",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Security Headers Middleware ───────────────────────────────────────────────
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Tüm HTTP yanıtlarına güvenlik header'ları ekler."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ── Global Exception Handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Yakalanmayan tüm hatalar için güvenli 500 yanıtı döner - sunucu çökmez."""
    tb = traceback.format_exc()
    logger.error(f"Yakalanmayan hata [{request.method} {request.url.path}]: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Sunucu hatası oluştu"},
    )


# ── Request Timeout Middleware ─────────────────────────────────────────────────
# NOT: asyncio.wait_for(call_next, ...) Windows'ta run_in_threadpool ile deadlock
# yapıyor. Bunun yerine sadece loglama yapıyoruz; gerçek timeout MSSQL login_timeout
# ve sorgu düzeyinde yönetiliyor.
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    """Yavaş istekleri loglar ve yanıtı geçirir. WebSocket upgrade isteklerini atlar."""
    # WebSocket handshake: HTTP middleware uygulanamaz, direkt geç
    if request.headers.get("upgrade", "").lower() == "websocket":
        return await call_next(request)

    start = time.time()
    try:
        response = await call_next(request)
        elapsed = time.time() - start
        if elapsed > 10:
            logger.warning(
                f"Yavaş istek [{request.method} {request.url.path}] "
                f"{elapsed:.1f}s — status={response.status_code}"
            )
        return response
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error(f"Middleware hatası [{request.method} {request.url.path}]: {exc}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Sunucu hatası oluştu"},
        )


# logging_middleware kaldırıldı — timeout_middleware ile birleştirildi


app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(audit_logs.router, prefix="/api/v1")
app.include_router(connections.router, prefix="/api/v1")
app.include_router(data_preview.router, prefix="/api/v1")
app.include_router(workflows.router, prefix="/api/v1")
app.include_router(folders.router, prefix="/api/v1")
app.include_router(executions.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(orchestrations.router, prefix="/api/v1")
