from typing import Any, Generator

import pyodbc

from app.connectors.base import BaseConnector
from app.utils.logger import logger


class MssqlConnector(BaseConnector):
    def __init__(self, config: dict):
        self.config = config
        self._connection_string = self._build_connection_string()

    def _build_connection_string(self) -> str:
        c = self.config
        parts = [
            f"DRIVER={{{c.get('driver', 'ODBC Driver 18 for SQL Server')}}}",
            f"SERVER={c['host']},{c.get('port', 1433)}",
            f"DATABASE={c['database']}",
            f"UID={c['username']}",
            f"PWD={c['password']}",
        ]
        if c.get("trust_server_certificate", True):
            parts.append("TrustServerCertificate=yes")
        if not c.get("encrypt", False):
            parts.append("Encrypt=no")
        return ";".join(parts)

    def _get_connection(self) -> pyodbc.Connection:
        return pyodbc.connect(self._connection_string, timeout=10)

    def test_connection(self) -> dict:
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1 AS test")
            cursor.close()
            conn.close()
            return {"success": True, "message": "Bağlantı başarılı"}
        except Exception as e:
            logger.error(f"MSSQL bağlantı testi başarısız: {e}")
            return {"success": False, "message": str(e)}

    def get_schemas(self) -> list[str]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY SCHEMA_NAME"
        )
        schemas = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return schemas

    def get_tables(self, schema: str) -> list[dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                t.TABLE_NAME,
                t.TABLE_SCHEMA,
                p.rows AS row_count
            FROM INFORMATION_SCHEMA.TABLES t
            LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME
            LEFT JOIN sys.partitions p ON st.object_id = p.object_id AND p.index_id IN (0, 1)
            WHERE t.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE'
            ORDER BY t.TABLE_NAME
            """,
            (schema,),
        )
        tables = []
        for row in cursor.fetchall():
            tables.append(
                {"name": row[0], "schema_name": row[1], "row_count": row[2]}
            )
        cursor.close()
        conn.close()
        return tables

    def get_columns(self, schema: str, table: str) -> list[dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                c.COLUMN_NAME,
                c.DATA_TYPE,
                CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END,
                c.CHARACTER_MAXIMUM_LENGTH,
                CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_pk
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
                AND kcu.TABLE_NAME = c.TABLE_NAME
                AND kcu.COLUMN_NAME = c.COLUMN_NAME
                AND kcu.CONSTRAINT_NAME IN (
                    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE CONSTRAINT_TYPE = 'PRIMARY KEY'
                    AND TABLE_SCHEMA = c.TABLE_SCHEMA
                    AND TABLE_NAME = c.TABLE_NAME
                )
            WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
            ORDER BY c.ORDINAL_POSITION
            """,
            (schema, table),
        )
        columns = []
        for row in cursor.fetchall():
            columns.append(
                {
                    "name": row[0],
                    "data_type": row[1],
                    "nullable": bool(row[2]),
                    "max_length": row[3],
                    "is_primary_key": bool(row[4]),
                }
            )
        cursor.close()
        conn.close()
        return columns

    def preview_data(self, schema: str, table: str, limit: int = 100) -> dict:
        conn = self._get_connection()
        cursor = conn.cursor()

        # Kolon bilgilerini al
        columns = self.get_columns(schema, table)

        # Veri çek (TOP ile limitli)
        safe_schema = schema.replace("]", "]]")
        safe_table = table.replace("]", "]]")
        cursor.execute(f"SELECT TOP {limit} * FROM [{safe_schema}].[{safe_table}]")

        col_names = [desc[0] for desc in cursor.description]
        rows = [dict(zip(col_names, row)) for row in cursor.fetchall()]

        cursor.close()
        conn.close()

        return {"columns": columns, "rows": rows, "total_rows": len(rows)}

    def execute_query_preview(self, query: str, limit: int = 100) -> dict:
        conn = self._get_connection()
        cursor = conn.cursor()

        # Sorguyu TOP ile sarmala (basit güvenlik)
        wrapped = f"SELECT TOP {limit} * FROM ({query}) AS preview_subquery"
        try:
            cursor.execute(wrapped)
        except Exception:
            # TOP sarmalama başarısızsa orijinal sorguyu dene
            cursor.execute(query)

        col_names = [desc[0] for desc in cursor.description]
        col_types = [desc[1].__name__ if hasattr(desc[1], '__name__') else str(desc[1]) for desc in cursor.description]
        rows = [dict(zip(col_names, row)) for row in cursor.fetchmany(limit)]

        columns = [
            {"name": name, "data_type": dtype, "nullable": True, "max_length": None, "is_primary_key": False}
            for name, dtype in zip(col_names, col_types)
        ]

        cursor.close()
        conn.close()

        return {"columns": columns, "rows": rows, "total_rows": len(rows)}

    def read_chunks(
        self, query: str, chunk_size: int = 5000
    ) -> Generator[list[dict[str, Any]], None, None]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(query)
        col_names = [desc[0] for desc in cursor.description]

        while True:
            rows = cursor.fetchmany(chunk_size)
            if not rows:
                break
            yield [dict(zip(col_names, row)) for row in rows]

        cursor.close()
        conn.close()

    def write_chunk(
        self, schema: str, table: str, rows: list[dict[str, Any]], mode: str = "append"
    ) -> int:
        if not rows:
            return 0

        conn = self._get_connection()
        cursor = conn.cursor()

        safe_schema = schema.replace("]", "]]")
        safe_table = table.replace("]", "]]")
        full_table = f"[{safe_schema}].[{safe_table}]"

        if mode == "overwrite":
            cursor.execute(f"TRUNCATE TABLE {full_table}")

        columns = list(rows[0].keys())
        safe_cols = ", ".join(f"[{c.replace(']', ']]')}]" for c in columns)
        placeholders = ", ".join(["?"] * len(columns))
        insert_sql = f"INSERT INTO {full_table} ({safe_cols}) VALUES ({placeholders})"

        values = [tuple(row.get(c) for c in columns) for row in rows]
        cursor.executemany(insert_sql, values)
        conn.commit()

        written = len(values)
        cursor.close()
        conn.close()
        return written

    def close(self):
        pass  # Bağlantılar her işlemde açılıp kapatılıyor
