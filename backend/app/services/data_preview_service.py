from __future__ import annotations

from typing import Any
from sqlalchemy.orm import Session

from app.services.connection_service import get_connection, get_connector
from app.services.mapping_service import apply_column_mappings, apply_filter, get_source_query
from app.utils.logger import logger


def get_schemas(db: Session, connection_id: str) -> list[str]:
    connection = get_connection(db, connection_id)
    if not connection:
        raise ValueError("Bağlantı bulunamadı")

    connector = get_connector(connection)
    try:
        return connector.get_schemas()
    finally:
        connector.close()


def get_tables(db: Session, connection_id: str, schema: str) -> list[dict]:
    connection = get_connection(db, connection_id)
    if not connection:
        raise ValueError("Bağlantı bulunamadı")

    connector = get_connector(connection)
    try:
        return connector.get_tables(schema)
    finally:
        connector.close()


def get_columns(db: Session, connection_id: str, schema: str, table: str) -> list[dict]:
    connection = get_connection(db, connection_id)
    if not connection:
        raise ValueError("Bağlantı bulunamadı")

    connector = get_connector(connection)
    try:
        return connector.get_columns(schema, table)
    finally:
        connector.close()


def preview_table(
    db: Session, connection_id: str, schema: str, table: str, limit: int = 100
) -> dict:
    connection = get_connection(db, connection_id)
    if not connection:
        raise ValueError("Bağlantı bulunamadı")

    connector = get_connector(connection)
    try:
        logger.info(f"Veri önizleme: {schema}.{table} (limit: {limit})")
        result = connector.preview_data(schema, table, limit)
        result["truncated"] = result["total_rows"] >= limit
        return result
    finally:
        connector.close()


def preview_query(db: Session, connection_id: str, query: str, limit: int = 100) -> dict:
    connection = get_connection(db, connection_id)
    if not connection:
        raise ValueError("Bağlantı bulunamadı")

    connector = get_connector(connection)
    try:
        logger.info(f"Sorgu önizleme: {query[:80]}... (limit: {limit})")
        result = connector.execute_query_preview(query, limit)
        result["truncated"] = result["total_rows"] >= limit
        return result
    finally:
        connector.close()


def preview_with_mapping(
    db: Session,
    connection_id: str,
    column_mappings: list[dict],
    schema: str | None = None,
    table: str | None = None,
    query: str | None = None,
    limit: int = 50,
) -> dict:
    """
    Kaynak veriye column mapping uygulayarak önizleme döner.
    Tüm veriyi belleğe yüklemez; sadece `limit` kadar satır çeker.
    """
    connection = get_connection(db, connection_id)
    if not connection:
        raise ValueError("Bağlantı bulunamadı")

    # Kaynak sorguyu belirle
    node_config: dict[str, Any] = {}
    if query:
        node_config["query"] = query
    elif schema and table:
        node_config["schema"] = schema
        node_config["table"] = table
    elif table:
        node_config["table"] = table
    else:
        raise ValueError("Tablo adı veya sorgu gerekli")

    src_query = get_source_query(node_config)
    if not src_query:
        raise ValueError("Kaynak sorgu oluşturulamadı")

    connector = get_connector(connection)
    try:
        logger.info("Mapping önizleme: %s (limit: %d)", src_query[:80], limit)
        raw = connector.execute_query_preview(src_query, limit)
        rows: list[dict] = raw.get("rows", [])

        mapped_rows = apply_column_mappings(rows, column_mappings)

        # Çıktı kolon listesi - mapping varsa hedef kolonlar, yoksa kaynak
        if column_mappings:
            out_cols = [
                {"name": m.get("target_column", m["source_column"]), "type": "string", "nullable": True}
                for m in column_mappings
                if not m.get("skip")
            ]
        else:
            out_cols = raw.get("columns", [])

        return {
            "columns": out_cols,
            "rows": mapped_rows,
            "total_rows": len(mapped_rows),
            "truncated": raw.get("total_rows", 0) >= limit,
        }
    finally:
        connector.close()
