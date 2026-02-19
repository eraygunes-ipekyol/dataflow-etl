from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.data_preview import (
    MappingPreviewRequest,
    PreviewQueryRequest,
    PreviewResponse,
    PreviewTableRequest,
)
from app.schemas.connection import ColumnInfo
from app.services import data_preview_service
from app.utils.logger import logger

router = APIRouter(prefix="/preview", tags=["data-preview"])


class QueryColumnsRequest(BaseModel):
    connection_id: str
    query: str


@router.post("/table", response_model=PreviewResponse)
async def preview_table(data: PreviewTableRequest, db: Session = Depends(get_db)):
    """Tablo önizleme — blocking DB+network çağrısı thread pool'da çalışır."""
    try:
        result = await run_in_threadpool(
            data_preview_service.preview_table,
            db, data.connection_id, data.schema_name, data.table_name, data.limit
        )
        return PreviewResponse(
            columns=[ColumnInfo(**c) for c in result["columns"]],
            rows=result["rows"],
            total_rows=result["total_rows"],
            truncated=result.get("truncated", False),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Tablo önizleme hatası [{data.connection_id}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query", response_model=PreviewResponse)
async def preview_query(data: PreviewQueryRequest, db: Session = Depends(get_db)):
    """Sorgu önizleme — blocking DB+network çağrısı thread pool'da çalışır."""
    try:
        result = await run_in_threadpool(
            data_preview_service.preview_query,
            db, data.connection_id, data.query, data.limit
        )
        return PreviewResponse(
            columns=[ColumnInfo(**c) for c in result["columns"]],
            rows=result["rows"],
            total_rows=result["total_rows"],
            truncated=result.get("truncated", False),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Sorgu önizleme hatası [{data.connection_id}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/columns", response_model=list[ColumnInfo])
async def get_query_columns(data: QueryColumnsRequest, db: Session = Depends(get_db)):
    """
    SQL sorgusunun döndüreceği kolon listesini çeker (veri satırları döndürmez).
    SQL sorgu modunda mapping için kaynak kolonları yüklemek için kullanılır.
    """
    try:
        result = await run_in_threadpool(
            data_preview_service.preview_query,
            db, data.connection_id, data.query, 1   # sadece 1 satır — kolon meta için
        )
        return [ColumnInfo(**c) for c in result["columns"]]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Sorgu kolon listesi hatası [{data.connection_id}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mapping", response_model=PreviewResponse)
async def preview_mapping(data: MappingPreviewRequest, db: Session = Depends(get_db)):
    """Kaynak veriye column mapping uygulanmış önizleme — thread pool'da çalışır."""
    try:
        mappings = [m.model_dump() for m in data.column_mappings]
        result = await run_in_threadpool(
            data_preview_service.preview_with_mapping,
            db, data.connection_id, mappings,
            data.schema_name, data.table_name, data.query, data.limit,
        )
        return PreviewResponse(
            columns=[ColumnInfo(**c) for c in result["columns"]],
            rows=result["rows"],
            total_rows=result["total_rows"],
            truncated=result.get("truncated", False),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Mapping önizleme hatası [{data.connection_id}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))
