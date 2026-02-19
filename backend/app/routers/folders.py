from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.folder import FolderCreate, FolderResponse, FolderTree, FolderUpdate
from app.services import folder_service
from app.utils.logger import logger

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=list[FolderResponse])
async def list_folders(parent_id: Optional[str] = None, db: Session = Depends(get_db)):
    return await run_in_threadpool(folder_service.list_folders, db, parent_id)


@router.get("/tree", response_model=list[FolderTree])
async def get_folder_tree(db: Session = Depends(get_db)):
    return await run_in_threadpool(folder_service.get_folder_tree, db)


@router.post("", response_model=FolderResponse, status_code=201)
async def create_folder(data: FolderCreate, db: Session = Depends(get_db)):
    try:
        return await run_in_threadpool(folder_service.create_folder, db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(folder_id: str, db: Session = Depends(get_db)):
    folder = await run_in_threadpool(folder_service.get_folder, db, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Klasör bulunamadı")
    return folder


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(folder_id: str, data: FolderUpdate, db: Session = Depends(get_db)):
    try:
        folder = await run_in_threadpool(folder_service.update_folder, db, folder_id, data)
        if not folder:
            raise HTTPException(status_code=404, detail="Klasör bulunamadı")
        return folder
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{folder_id}", status_code=204)
async def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    ok = await run_in_threadpool(folder_service.delete_folder, db, folder_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Klasör bulunamadı")
