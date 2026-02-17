from sqlalchemy.orm import Session

from app.services.connection_service import get_connection, get_connector
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
