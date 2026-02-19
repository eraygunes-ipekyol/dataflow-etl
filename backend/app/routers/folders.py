from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.folder import FolderCreate, FolderResponse, FolderTree, FolderUpdate
from app.services import audit_service, folder_service
from app.utils.auth_deps import get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/folders", tags=["folders"], dependencies=[Depends(get_current_user)])


def _get_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


@router.get("", response_model=list[FolderResponse])
async def list_folders(parent_id: Optional[str] = None, db: Session = Depends(get_db)):
    return await run_in_threadpool(folder_service.list_folders, db, parent_id)


@router.get("/tree", response_model=list[FolderTree])
async def get_folder_tree(db: Session = Depends(get_db)):
    return await run_in_threadpool(folder_service.get_folder_tree, db)


@router.post("", response_model=FolderResponse, status_code=201)
async def create_folder(
    data: FolderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        folder = await run_in_threadpool(folder_service.create_folder, db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "create", "folder",
        folder.id, folder.name,
        None, {"name": folder.name, "parent_id": folder.parent_id},
        _get_ip(request),
    )
    return folder


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(folder_id: str, db: Session = Depends(get_db)):
    folder = await run_in_threadpool(folder_service.get_folder, db, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Klasör bulunamadı")
    return folder


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    data: FolderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = await run_in_threadpool(folder_service.get_folder, db, folder_id)
    old_value = {"name": old.name} if old else None

    try:
        folder = await run_in_threadpool(folder_service.update_folder, db, folder_id, data)
        if not folder:
            raise HTTPException(status_code=404, detail="Klasör bulunamadı")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "update", "folder",
        folder_id, folder.name,
        old_value, {"name": folder.name},
        _get_ip(request),
    )
    return folder


@router.delete("/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old = await run_in_threadpool(folder_service.get_folder, db, folder_id)
    name = old.name if old else folder_id

    ok = await run_in_threadpool(folder_service.delete_folder, db, folder_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Klasör bulunamadı")

    await run_in_threadpool(
        audit_service.log_action, db,
        current_user.id, current_user.username,
        "delete", "folder",
        folder_id, name,
        None, None, _get_ip(request),
    )
