from typing import Optional

from sqlalchemy.orm import Session

from app.models.folder import Folder
from app.models.workflow import Workflow
from app.schemas.folder import FolderCreate, FolderTree, FolderUpdate
from app.utils.logger import logger


def list_folders(db: Session, parent_id: Optional[str] = None) -> list[Folder]:
    """Belirtilen parent_id altındaki klasörleri listeler. None ise root klasörler."""
    query = db.query(Folder).filter(Folder.parent_id == parent_id).order_by(Folder.name)
    return query.all()


def get_folder(db: Session, folder_id: str) -> Optional[Folder]:
    return db.query(Folder).filter(Folder.id == folder_id).first()


def create_folder(db: Session, data: FolderCreate) -> Folder:
    folder = Folder(
        name=data.name,
        parent_id=data.parent_id,
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    logger.info(f"Klasör oluşturuldu: {folder.name} (parent: {folder.parent_id})")
    return folder


def update_folder(db: Session, folder_id: str, data: FolderUpdate) -> Optional[Folder]:
    folder = get_folder(db, folder_id)
    if not folder:
        return None

    if data.name is not None:
        folder.name = data.name
    if data.parent_id is not None:
        # Kendisine parent olamaz kontrolü
        if data.parent_id == folder_id:
            raise ValueError("Klasör kendisine parent olamaz")
        folder.parent_id = data.parent_id

    db.commit()
    db.refresh(folder)
    logger.info(f"Klasör güncellendi: {folder.name}")
    return folder


def delete_folder(db: Session, folder_id: str) -> bool:
    folder = get_folder(db, folder_id)
    if not folder:
        return False

    db.delete(folder)
    db.commit()
    logger.info(f"Klasör silindi: {folder.name}")
    return True


def get_folder_tree(db: Session) -> list[FolderTree]:
    """Tüm klasör ağacını döner (recursive)."""
    root_folders = list_folders(db, parent_id=None)
    return [_build_folder_tree(db, folder) for folder in root_folders]


def _build_folder_tree(db: Session, folder: Folder) -> FolderTree:
    """Bir klasörün alt ağacını oluşturur (recursive)."""
    children = list_folders(db, parent_id=folder.id)
    workflows = db.query(Workflow).filter(Workflow.folder_id == folder.id).all()

    return FolderTree(
        id=folder.id,
        name=folder.name,
        parent_id=folder.parent_id,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        children=[_build_folder_tree(db, child) for child in children],
        workflows=[{"id": w.id, "name": w.name, "is_active": w.is_active} for w in workflows],
    )
