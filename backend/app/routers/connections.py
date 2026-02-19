from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.connection import (
    ColumnInfo,
    ConnectionCreate,
    ConnectionDetail,
    ConnectionResponse,
    ConnectionTestResult,
    ConnectionUpdate,
    SchemaInfo,
    TableInfo,
)
from app.services import audit_service, connection_service, data_preview_service
from app.utils.auth_deps import get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/connections", tags=["connections"], dependencies=[Depends(get_current_user)])


def _get_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(db: Session = Depends(get_db)):
    return await run_in_threadpool(connection_service.list_connections, db)


@router.post("", response_model=ConnectionResponse, status_code=201)
async def create_connection(
    data: ConnectionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        connection = await run_in_threadpool(connection_service.create_connection, db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "create", "connection",
        connection.id, connection.name,
        None, {"type": connection.type},
        _get_ip(request),
    )
    return connection


@router.get("/{connection_id}", response_model=ConnectionDetail)
async def get_connection(connection_id: str, db: Session = Depends(get_db)):
    connection = await run_in_threadpool(connection_service.get_connection, db, connection_id)
    if not connection:
        raise HTTPException(status_code=404, detail="Bağlantı bulunamadı")

    config = await run_in_threadpool(connection_service.get_decrypted_config, connection)
    return ConnectionDetail(
        id=connection.id,
        name=connection.name,
        type=connection.type,
        is_active=connection.is_active,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
        config=config,
    )


@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: str,
    data: ConnectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = await run_in_threadpool(connection_service.get_connection, db, connection_id)
    old_value = {"name": old.name, "type": old.type, "is_active": old.is_active} if old else None

    connection = await run_in_threadpool(connection_service.update_connection, db, connection_id, data)
    if not connection:
        raise HTTPException(status_code=404, detail="Bağlantı bulunamadı")

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "update", "connection",
        connection_id, connection.name,
        old_value, {"name": connection.name, "type": connection.type, "is_active": connection.is_active},
        _get_ip(request),
    )
    return connection


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(
    connection_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = await run_in_threadpool(connection_service.get_connection, db, connection_id)
    name = old.name if old else connection_id

    ok = await run_in_threadpool(connection_service.delete_connection, db, connection_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Bağlantı bulunamadı")

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "delete", "connection",
        connection_id, name,
        None, None, _get_ip(request),
    )


@router.post("/{connection_id}/test", response_model=ConnectionTestResult)
async def test_connection(connection_id: str, db: Session = Depends(get_db)):
    """Bağlantıyı test eder — network I/O thread pool'da çalışır."""
    try:
        result = await run_in_threadpool(
            connection_service.test_connection_by_id, db, connection_id
        )
        return ConnectionTestResult(**result)
    except Exception as e:
        logger.error(f"Bağlantı testi hatası [{connection_id}]: {e}")
        return ConnectionTestResult(success=False, message=str(e))


@router.post("/test", response_model=ConnectionTestResult)
async def test_connection_config(data: ConnectionCreate):
    """Config'i kaydetmeden önce test eder."""
    try:
        config = data.config.model_dump()
        result = await run_in_threadpool(
            connection_service.test_connection_config, data.type, config
        )
        return ConnectionTestResult(**result)
    except Exception as e:
        logger.error(f"Bağlantı config testi hatası: {e}")
        return ConnectionTestResult(success=False, message=str(e))


@router.get("/{connection_id}/schemas", response_model=list[SchemaInfo])
async def get_schemas(connection_id: str, db: Session = Depends(get_db)):
    """Şema/dataset listesi — blocking DB+network çağrısı thread pool'da."""
    try:
        schemas = await run_in_threadpool(
            data_preview_service.get_schemas, db, connection_id
        )
        return [SchemaInfo(name=s) for s in schemas]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Şema listesi hatası [{connection_id}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{connection_id}/tables", response_model=list[TableInfo])
async def get_tables(
    connection_id: str, schema: str = "dbo", db: Session = Depends(get_db)
):
    """Tablo listesi — blocking DB+network çağrısı thread pool'da."""
    try:
        tables = await run_in_threadpool(
            data_preview_service.get_tables, db, connection_id, schema
        )
        return [TableInfo(**t) for t in tables]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Tablo listesi hatası [{connection_id}/{schema}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{connection_id}/tables/{table}/columns", response_model=list[ColumnInfo])
async def get_columns(
    connection_id: str,
    table: str,
    schema: str = "dbo",
    db: Session = Depends(get_db),
):
    """Kolon listesi — blocking çağrı thread pool'da."""
    try:
        columns = await run_in_threadpool(
            data_preview_service.get_columns, db, connection_id, schema, table
        )
        return [ColumnInfo(**c) for c in columns]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Kolon listesi hatası [{connection_id}/{schema}.{table}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))
