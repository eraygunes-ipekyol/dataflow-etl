from __future__ import annotations

import json
from typing import Optional

from sqlalchemy.orm import Session

from app.connectors.base import BaseConnector
from app.connectors.bigquery_connector import BigQueryConnector
from app.connectors.mssql_connector import MssqlConnector
from app.models.connection import Connection
from app.schemas.connection import ConnectionCreate, ConnectionUpdate
from app.utils.encryption import decrypt_value, encrypt_value
from app.utils.logger import logger


def get_connector(connection: Connection) -> BaseConnector:
    """Connection modeline göre uygun connector döner."""
    config = json.loads(decrypt_value(connection.config))

    if connection.type == "mssql":
        return MssqlConnector(config)
    elif connection.type == "bigquery":
        return BigQueryConnector(config)
    else:
        raise ValueError(f"Bilinmeyen bağlantı tipi: {connection.type}")


def get_connector_from_config(conn_type: str, config: dict) -> BaseConnector:
    """Config dict'ten doğrudan connector oluşturur (test için)."""
    if conn_type == "mssql":
        return MssqlConnector(config)
    elif conn_type == "bigquery":
        return BigQueryConnector(config)
    else:
        raise ValueError(f"Bilinmeyen bağlantı tipi: {conn_type}")


def list_connections(db: Session) -> list[Connection]:
    return db.query(Connection).order_by(Connection.created_at.desc()).all()


def get_connection(db: Session, connection_id: str) -> Optional[Connection]:
    return db.query(Connection).filter(Connection.id == connection_id).first()


def create_connection(db: Session, data: ConnectionCreate) -> Connection:
    config_json = data.config.model_dump_json()
    encrypted_config = encrypt_value(config_json)

    connection = Connection(
        name=data.name,
        type=data.type,
        config=encrypted_config,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    logger.info(f"Bağlantı oluşturuldu: {connection.name} ({connection.type})")
    return connection


def update_connection(db: Session, connection_id: str, data: ConnectionUpdate) -> Optional[Connection]:
    connection = get_connection(db, connection_id)
    if not connection:
        return None

    if data.name is not None:
        connection.name = data.name
    if data.is_active is not None:
        connection.is_active = data.is_active
    if data.config is not None:
        new_config = data.config.model_dump(exclude_none=True)

        # Sifre/credentials gonderilmediyse mevcut config'ten tamamla
        existing_config = json.loads(decrypt_value(connection.config))
        if connection.type == "mssql" and "password" not in new_config:
            new_config["password"] = existing_config.get("password", "")
        if connection.type == "bigquery" and "credentials_json" not in new_config:
            new_config["credentials_json"] = existing_config.get("credentials_json", "")

        connection.config = encrypt_value(json.dumps(new_config))

    db.commit()
    db.refresh(connection)
    logger.info(f"Bağlantı güncellendi: {connection.name}")
    return connection


def delete_connection(db: Session, connection_id: str) -> bool:
    connection = get_connection(db, connection_id)
    if not connection:
        return False

    db.delete(connection)
    db.commit()
    logger.info(f"Bağlantı silindi: {connection.name}")
    return True


def test_connection_by_id(db: Session, connection_id: str) -> dict:
    connection = get_connection(db, connection_id)
    if not connection:
        return {"success": False, "message": "Bağlantı bulunamadı"}

    connector = get_connector(connection)
    try:
        return connector.test_connection()
    finally:
        connector.close()


def test_connection_config(conn_type: str, config: dict) -> dict:
    """Kaydedilmeden önce bağlantı configini test eder."""
    connector = get_connector_from_config(conn_type, config)
    try:
        return connector.test_connection()
    finally:
        connector.close()


def get_decrypted_config(connection: Connection) -> dict:
    """Şifresi çözülmüş config döner (password maskelenmiş)."""
    config = json.loads(decrypt_value(connection.config))

    if connection.type == "mssql" and "password" in config:
        config["password"] = "••••••••"

    if connection.type == "bigquery" and "credentials_json" in config:
        if isinstance(config["credentials_json"], str):
            try:
                cred = json.loads(config["credentials_json"])
                config["credentials_json"] = {
                    "type": cred.get("type", ""),
                    "project_id": cred.get("project_id", ""),
                    "client_email": cred.get("client_email", ""),
                }
            except json.JSONDecodeError:
                config["credentials_json"] = "••••••••"

    return config
