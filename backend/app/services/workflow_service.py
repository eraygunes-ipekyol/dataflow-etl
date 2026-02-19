import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate, WorkflowValidationResult
from app.utils.logger import logger


def list_workflows(db: Session, folder_id: Optional[str] = None) -> list[Workflow]:
    query = db.query(Workflow).order_by(Workflow.updated_at.desc())
    if folder_id is not None:
        query = query.filter(Workflow.folder_id == folder_id)
    return query.all()


def get_workflow(db: Session, workflow_id: str) -> Optional[Workflow]:
    return db.query(Workflow).filter(Workflow.id == workflow_id).first()


def create_workflow(db: Session, data: WorkflowCreate) -> Workflow:
    definition_json = json.dumps(data.definition)

    workflow = Workflow(
        name=data.name,
        description=data.description,
        folder_id=data.folder_id,
        definition=definition_json,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    logger.info(f"Workflow oluşturuldu: {workflow.name} (id: {workflow.id})")
    return workflow


def update_workflow(db: Session, workflow_id: str, data: WorkflowUpdate) -> Optional[Workflow]:
    workflow = get_workflow(db, workflow_id)
    if not workflow:
        return None

    if data.name is not None:
        workflow.name = data.name
    if data.description is not None:
        workflow.description = data.description
    if data.folder_id is not None:
        workflow.folder_id = data.folder_id
    if data.definition is not None:
        workflow.definition = json.dumps(data.definition)
        workflow.version += 1
    if data.is_active is not None:
        workflow.is_active = data.is_active

    db.commit()
    db.refresh(workflow)
    logger.info(f"Workflow güncellendi: {workflow.name} (version: {workflow.version})")
    return workflow


def delete_workflow(db: Session, workflow_id: str) -> bool:
    workflow = get_workflow(db, workflow_id)
    if not workflow:
        return False

    db.delete(workflow)
    db.commit()
    logger.info(f"Workflow silindi: {workflow.name}")
    return True


def validate_workflow(db: Session, workflow_id: str) -> WorkflowValidationResult:
    """Workflow tanımını doğrular (nodes, edges, bağlantılar)."""
    workflow = get_workflow(db, workflow_id)
    if not workflow:
        return WorkflowValidationResult(valid=False, errors=["Workflow bulunamadı"])

    try:
        definition = json.loads(workflow.definition)
    except json.JSONDecodeError:
        return WorkflowValidationResult(valid=False, errors=["Geçersiz JSON tanımı"])

    errors = []
    warnings = []

    # Nodes ve edges var mı?
    if "nodes" not in definition or not isinstance(definition["nodes"], list):
        errors.append("Nodes tanımı eksik veya geçersiz")
    if "edges" not in definition or not isinstance(definition["edges"], list):
        errors.append("Edges tanımı eksik veya geçersiz")

    if errors:
        return WorkflowValidationResult(valid=False, errors=errors, warnings=warnings)

    nodes = definition["nodes"]
    edges = definition["edges"]
    node_ids = {n["id"] for n in nodes if "id" in n}

    # Her node'un id, type, position, data alanları var mı?
    for i, node in enumerate(nodes):
        if "id" not in node:
            errors.append(f"Node {i}: id eksik")
        if "type" not in node:
            errors.append(f"Node {i}: type eksik")
        if "position" not in node or "x" not in node.get("position", {}) or "y" not in node.get("position", {}):
            errors.append(f"Node {i}: position eksik veya geçersiz")
        if "data" not in node:
            warnings.append(f"Node {i}: data alanı yok")

    # Edge'lerin source ve target'ları mevcut node'lara işaret ediyor mu?
    for i, edge in enumerate(edges):
        if "source" not in edge or edge["source"] not in node_ids:
            errors.append(f"Edge {i}: source eksik veya geçersiz")
        if "target" not in edge or edge["target"] not in node_ids:
            errors.append(f"Edge {i}: target eksik veya geçersiz")

    # En az bir source node olmalı
    source_nodes = [n for n in nodes if n.get("type") == "source"]
    if not source_nodes:
        warnings.append("Hiçbir source node yok")

    # En az bir destination node olmalı
    dest_nodes = [n for n in nodes if n.get("type") == "destination"]
    if not dest_nodes:
        warnings.append("Hiçbir destination node yok")

    return WorkflowValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


def export_workflow(db: Session, workflow_id: str) -> Optional[dict]:
    """Workflow'u JSON olarak export eder."""
    workflow = get_workflow(db, workflow_id)
    if not workflow:
        return None

    return {
        "name": workflow.name,
        "description": workflow.description,
        "definition": json.loads(workflow.definition),
        "version": workflow.version,
        "exported_at": datetime.now().isoformat(),
    }


def import_workflow(db: Session, data: dict, folder_id: Optional[str] = None) -> Workflow:
    """JSON'dan workflow import eder."""
    from datetime import datetime

    workflow = Workflow(
        name=data.get("name", "Imported Workflow"),
        description=data.get("description"),
        folder_id=folder_id,
        definition=json.dumps(data.get("definition", {"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}})),
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    logger.info(f"Workflow import edildi: {workflow.name}")
    return workflow
