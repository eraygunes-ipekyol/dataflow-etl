"""
Workflow execution servisi.

Workflow definition'daki node'ları topological sırada çalıştırır.
Veriler chunk bazlı aktarılır; tamamı belleğe yüklenmez.
Her node işleminden önce/sonra ExecutionLog kaydı oluşturulur.
"""
from __future__ import annotations

import json
import uuid
from collections import defaultdict, deque
from datetime import datetime
from app.utils.timezone import now_istanbul
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.execution import Execution, ExecutionLog
from app.models.workflow import Workflow
from app.services.connection_service import get_connection, get_connector
from app.services.mapping_service import apply_column_mappings, apply_filter, get_source_query
from app.utils.logger import logger


# ─── Yardımcı: log kaydetme ────────────────────────────────────────────────

def _log(
    db: Session,
    execution_id: str,
    message: str,
    level: str = "info",
    node_id: Optional[str] = None,
) -> None:
    entry = ExecutionLog(
        execution_id=execution_id,
        node_id=node_id,
        level=level,
        message=message,
    )
    db.add(entry)
    db.commit()
    logger.info("[exec:%s][%s] %s", execution_id[:8], level, message)


# ─── Topological sort (Kahn's algorithm) ──────────────────────────────────

def _topological_sort(nodes: list[dict], edges: list[dict]) -> list[dict]:
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    adj: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src in in_degree and tgt in in_degree:
            in_degree[tgt] += 1
            adj[src].append(tgt)

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    order: list[str] = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for nxt in adj[nid]:
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)

    node_map = {n["id"]: n for n in nodes}
    return [node_map[nid] for nid in order if nid in node_map]


# ─── Node çalıştırıcılar ──────────────────────────────────────────────────

def _run_source_node(
    db: Session,
    execution_id: str,
    node: dict,
    chunk_size: int = 5000,
):
    """Kaynak node'dan veriyi chunk'lar halinde yield eder."""
    cfg: dict = node.get("data", {}).get("config") or {}
    conn_id = cfg.get("connection_id")
    if not conn_id:
        raise ValueError(f"Source node {node['id']}: connection_id eksik")

    query = get_source_query(cfg)
    if not query:
        raise ValueError(f"Source node {node['id']}: sorgu oluşturulamadı (tablo veya sorgu belirtilmeli)")

    connection = get_connection(db, conn_id)
    if not connection:
        raise ValueError(f"Bağlantı bulunamadı: {conn_id}")

    connector = get_connector(connection)
    _log(db, execution_id, f"Kaynak okunuyor: {query[:80]}{'...' if len(query) > 80 else ''}", node_id=node["id"])
    try:
        chunk_count = 0
        for chunk in connector.read_chunks(query, chunk_size):
            chunk_count += 1
            _log(db, execution_id, f"Chunk {chunk_count}: {len(chunk)} satır okundu", node_id=node["id"])
            yield chunk
        _log(db, execution_id, f"Okuma tamamlandı ({chunk_count} chunk)", node_id=node["id"])
    finally:
        connector.close()


def _run_transform_node(node: dict, rows: list[dict]) -> list[dict]:
    cfg: dict = node.get("data", {}).get("config") or {}
    mappings: list[dict] = cfg.get("column_mappings") or []
    return apply_column_mappings(rows, mappings)


def _run_filter_node(node: dict, rows: list[dict]) -> list[dict]:
    cfg: dict = node.get("data", {}).get("config") or {}
    condition: str = cfg.get("condition") or ""
    return apply_filter(rows, condition)


def _run_destination_node(
    db: Session,
    execution_id: str,
    node: dict,
    chunks,  # generator
) -> tuple[int, int]:
    """
    Hedef node'a yazma. (rows_written, rows_failed) döner.

    Config parametreleri:
      write_mode    : append | overwrite | upsert
      chunk_size    : kaynak okuma chunk boyutu (execution servisi bu değeri kullanır)
      on_error      : rollback | continue
                      rollback → bir chunk hatası tüm işlemi geri alır
                      continue → hatalı chunk atlanır, diğerleri yazılır
      batch_size    : multi-row INSERT içindeki satır sayısı (varsayılan 500)
    """
    cfg: dict = node.get("data", {}).get("config") or {}
    conn_id = cfg.get("connection_id")
    if not conn_id:
        raise ValueError(f"Destination node {node['id']}: connection_id eksik")

    schema = cfg.get("schema") or "dbo"
    table = cfg.get("table")
    if not table:
        raise ValueError(f"Destination node {node['id']}: tablo adı eksik")

    write_mode = cfg.get("write_mode", "append")
    on_error   = cfg.get("on_error", "rollback")   # rollback | continue
    batch_size = int(cfg.get("batch_size") or 500)
    mappings: list[dict] = cfg.get("column_mappings") or []

    connection = get_connection(db, conn_id)
    if not connection:
        raise ValueError(f"Bağlantı bulunamadı: {conn_id}")

    connector = get_connector(connection)
    total_written = 0
    total_failed = 0
    first_chunk = True

    # Kolon tip haritasını tek seferde al (her chunk için tekrar çekme)
    from app.connectors.mssql_connector import MssqlConnector
    col_type_map: Optional[dict] = None
    if isinstance(connector, MssqlConnector):
        try:
            col_type_map = connector.get_column_types(schema, table)
            _log(db, execution_id,
                 f"Kolon tipleri yüklendi: {len(col_type_map)} kolon",
                 node_id=node["id"])
        except Exception as meta_err:
            _log(db, execution_id,
                 f"Kolon tip bilgisi alınamadı (devam ediliyor): {meta_err}",
                 level="warning", node_id=node["id"])

    _log(db, execution_id,
         f"Hedef yazılıyor: {schema}.{table} (mod: {write_mode}, hata: {on_error}, batch: {batch_size})",
         node_id=node["id"])

    chunk_index = 0
    last_error = None
    try:
        for chunk in chunks:
            if not chunk:
                continue
            chunk_index += 1
            if mappings:
                chunk = apply_column_mappings(chunk, mappings)

            mode = write_mode if first_chunk else "append"

            # write_chunk çağrısı — MssqlConnector için extra parametreler
            write_kwargs: dict = {"mode": mode}
            if isinstance(connector, MssqlConnector):
                write_kwargs["col_type_map"] = col_type_map
                write_kwargs["on_error"] = on_error
                write_kwargs["batch_size"] = batch_size

            try:
                written = connector.write_chunk(schema, table, chunk, **write_kwargs)
                total_written += written
                first_chunk = False
                _log(db, execution_id,
                     f"Chunk {chunk_index}: {written} satır yazıldı (toplam: {total_written})",
                     node_id=node["id"])
            except Exception as chunk_err:
                total_failed += len(chunk)
                last_error = chunk_err
                _log(db, execution_id,
                     f"Chunk {chunk_index} yazma hatası ({len(chunk)} satır): {chunk_err}",
                     level="error", node_id=node["id"])
                if on_error == "rollback" or (write_mode == "overwrite" and first_chunk):
                    raise chunk_err
                first_chunk = False

    except Exception as e:
        if e is not last_error:
            _log(db, execution_id, f"Yazma akışı hatası: {e}", level="error", node_id=node["id"])
        raise
    finally:
        connector.close()

    if total_written == 0 and last_error is not None:
        raise last_error

    return total_written, total_failed


# ─── SQL Execute node ─────────────────────────────────────────────────────

def _run_sql_execute_node(
    db: Session,
    execution_id: str,
    node: dict,
) -> None:
    """
    Serbest SQL sorgusu çalıştırır (INSERT, UPDATE, DELETE, TRUNCATE, DDL vs.).
    Sonuç döndürmez; etkilenen satır sayısını loglar.
    """
    cfg: dict = node.get("data", {}).get("config") or {}
    conn_id = cfg.get("connection_id")
    if not conn_id:
        raise ValueError(f"SQL Execute node {node['id']}: connection_id eksik")

    sql: str = (cfg.get("sql") or "").strip()
    if not sql:
        raise ValueError(f"SQL Execute node {node['id']}: SQL sorgusu boş")

    connection = get_connection(db, conn_id)
    if not connection:
        raise ValueError(f"Bağlantı bulunamadı: {conn_id}")

    connector = get_connector(connection)
    preview_lines = sql[:100].replace("\n", " ")
    _log(db, execution_id, f"SQL çalıştırılıyor: {preview_lines}{'...' if len(sql) > 100 else ''}", node_id=node["id"])

    try:
        affected = connector.execute_non_query(sql)
        _log(db, execution_id, f"SQL tamamlandı. Etkilenen satır: {affected}", node_id=node["id"])
    finally:
        connector.close()


# ─── Ana execution fonksiyonu ─────────────────────────────────────────────

def run_workflow(
    db: Session,
    workflow_id: str,
    trigger_type: str = "manual",
    execution_id: Optional[str] = None,
) -> str:
    """
    Workflow'u çalıştırır. execution_id döner.
    execution_id parametresi verilirse mevcut kaydı günceller,
    verilmezse yeni kayıt oluşturur.
    """
    workflow: Optional[Workflow] = db.get(Workflow, workflow_id)
    if not workflow:
        raise ValueError(f"Workflow bulunamadı: {workflow_id}")

    # Execution kaydını bul veya oluştur
    if execution_id:
        execution = db.get(Execution, execution_id)
        if execution:
            execution.status = "running"
            execution.started_at = now_istanbul()
            db.commit()
        else:
            execution_id = None  # fallback: yeni oluştur

    if not execution_id:
        execution = Execution(
            id=uuid.uuid4().hex,
            workflow_id=workflow_id,
            status="running",
            trigger_type=trigger_type,
            started_at=now_istanbul(),
        )
        db.add(execution)
        db.commit()
        execution_id = execution.id

    _log(db, execution_id, f"Workflow başlatıldı: {workflow.name}")

    try:
        definition: dict = json.loads(workflow.definition)
        nodes: list[dict] = definition.get("nodes", [])
        edges: list[dict] = definition.get("edges", [])

        if not nodes:
            raise ValueError("Workflow'da hiç node yok")

        sorted_nodes = _topological_sort(nodes, edges)
        _log(db, execution_id, f"{len(sorted_nodes)} node çalışacak")

        total_rows = 0
        total_failed = 0

        # Node çıktılarını zincirlemek için buffer
        node_outputs: dict[str, Any] = {}  # node_id → generator veya rows

        for node in sorted_nodes:
            node_id = node["id"]
            node_type = node.get("type", "")
            node_label = node.get("data", {}).get("label") or node_type
            node_disabled = node.get("data", {}).get("disabled", False)

            # Bu node'a gelen kaynak node'ları bul
            incoming_sources = [
                e["source"] for e in edges if e.get("target") == node_id
            ]

            # Pasif (disabled) node'ları atla
            if node_disabled:
                _log(db, execution_id, f"Node atlandı (pasif): {node_label} ({node_id[:8]})", level="warning", node_id=node_id)
                continue

            _log(db, execution_id, f"Node çalışıyor: [{node_label}] ({node_type})", node_id=node_id)

            if node_type == "source":
                chunk_size = (node.get("data", {}).get("config") or {}).get("chunk_size", 5000)
                node_outputs[node_id] = _run_source_node(db, execution_id, node, chunk_size)

            elif node_type == "destination":
                def merged_upstream(sources=incoming_sources, outputs=node_outputs):
                    for src_id in sources:
                        gen = outputs.get(src_id)
                        if gen is None:
                            continue
                        if hasattr(gen, "__next__") or hasattr(gen, "__iter__"):
                            yield from gen
                        else:
                            yield from [gen]

                written, failed = _run_destination_node(
                    db, execution_id, node, merged_upstream()
                )
                total_rows += written
                total_failed += failed

            elif node_type in ("transform", "filter"):
                def transform_gen(src_ids=incoming_sources, node_ref=node, outputs=node_outputs, ntype=node_type):
                    for src_id in src_ids:
                        gen = outputs.get(src_id)
                        if gen is None:
                            continue
                        stream = gen if hasattr(gen, "__next__") else iter([gen])
                        for chunk in stream:
                            if ntype == "transform":
                                yield _run_transform_node(node_ref, chunk)
                            else:
                                yield _run_filter_node(node_ref, chunk)

                node_outputs[node_id] = transform_gen()

            elif node_type == "sqlExecute":
                _run_sql_execute_node(db, execution_id, node)

            else:
                _log(db, execution_id, f"Bilinmeyen node tipi atlandı: {node_type}", level="warning", node_id=node_id)

        # Execution'ı tamamla
        exec_record = db.get(Execution, execution_id)
        if exec_record:
            exec_record.status = "success"
            exec_record.rows_processed = total_rows
            exec_record.rows_failed = total_failed
            exec_record.finished_at = now_istanbul()
            db.commit()

        _log(db, execution_id, f"Workflow tamamlandı. {total_rows} satır aktarıldı.")
        return execution_id

    except Exception as e:
        logger.exception("Execution hatası: %s", e)
        exec_record = db.get(Execution, execution_id)
        if exec_record:
            exec_record.status = "failed"
            exec_record.error_message = str(e)
            exec_record.finished_at = now_istanbul()
            db.commit()
        _log(db, execution_id, f"Hata: {e}", level="error")
        return execution_id


# ─── Sorgu fonksiyonları ──────────────────────────────────────────────────

def list_executions(
    db: Session,
    workflow_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
) -> list:
    """
    Execution listesi döner. Her kayda workflow.name eklenir.
    Filtreler: workflow_id, date_from/to (ISO date), status.
    """
    from app.models.workflow import Workflow
    from datetime import datetime as _dt

    q = (
        db.query(Execution, Workflow.name.label("workflow_name"))
        .join(Workflow, Execution.workflow_id == Workflow.id, isouter=True)
    )

    if workflow_id:
        q = q.filter(Execution.workflow_id == workflow_id)
    if status:
        q = q.filter(Execution.status == status)
    if date_from:
        try:
            dt_from = _dt.fromisoformat(date_from)
            q = q.filter(Execution.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            # date_to dahil: gün sonuna kadar
            dt_to = _dt.fromisoformat(date_to).replace(hour=23, minute=59, second=59)
            q = q.filter(Execution.created_at <= dt_to)
        except ValueError:
            pass

    rows = q.order_by(Execution.created_at.desc()).limit(limit).all()

    # Sonuçları dict listesine dönüştür (workflow_name eklenerek)
    result = []
    for execution, workflow_name in rows:
        # Execution nesnesini dict'e çevir, workflow_name ekle
        exec_dict = {
            "id": execution.id,
            "workflow_id": execution.workflow_id,
            "workflow_name": workflow_name,
            "status": execution.status,
            "trigger_type": execution.trigger_type,
            "error_message": execution.error_message,
            "rows_processed": execution.rows_processed,
            "rows_failed": execution.rows_failed,
            "started_at": execution.started_at,
            "finished_at": execution.finished_at,
            "created_at": execution.created_at,
        }
        result.append(exec_dict)
    return result


def get_execution(db: Session, execution_id: str) -> Optional[Execution]:
    return db.get(Execution, execution_id)


def get_execution_logs(db: Session, execution_id: str) -> list[ExecutionLog]:
    return (
        db.query(ExecutionLog)
        .filter(ExecutionLog.execution_id == execution_id)
        .order_by(ExecutionLog.created_at)
        .all()
    )


def cancel_execution(db: Session, execution_id: str) -> bool:
    execution = db.get(Execution, execution_id)
    if not execution or execution.status not in ("pending", "running"):
        return False
    execution.status = "cancelled"
    execution.finished_at = now_istanbul()
    db.commit()
    return True
