from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.data_preview import PreviewQueryRequest, PreviewResponse, PreviewTableRequest
from app.schemas.connection import ColumnInfo
from app.services import data_preview_service

router = APIRouter(prefix="/preview", tags=["data-preview"])


@router.post("/table", response_model=PreviewResponse)
async def preview_table(data: PreviewTableRequest, db: Session = Depends(get_db)):
    try:
        result = data_preview_service.preview_table(
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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query", response_model=PreviewResponse)
async def preview_query(data: PreviewQueryRequest, db: Session = Depends(get_db)):
    try:
        result = data_preview_service.preview_query(
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
        raise HTTPException(status_code=500, detail=str(e))
