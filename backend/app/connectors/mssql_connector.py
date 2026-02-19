import datetime
import decimal
from typing import Any, Generator, Optional

import pymssql

from app.connectors.base import BaseConnector
from app.utils.logger import logger


_NUMERIC_TYPES = frozenset({
    "numeric", "decimal", "float", "real",
    "int", "bigint", "smallint", "tinyint", "money", "smallmoney",
})
_INT_TYPES = frozenset({"int", "bigint", "smallint", "tinyint"})


_DATE_TYPES = frozenset({"date", "datetime", "datetime2", "smalldatetime", "time", "datetimeoffset"})
_STRING_TYPES = frozenset({"char", "varchar", "nchar", "nvarchar", "text", "ntext"})

# pymssql cursor.description type_code → okunabilir SQL tip adı
# Kaynak: https://github.com/pymssql/pymssql/blob/master/src/pymssql/_pymssql.pyx
_PYMSSQL_TYPE_MAP: dict[int, str] = {
    1:  "bit",
    2:  "int",       # TINYINT / SMALLINT / INT
    3:  "int",
    4:  "float",
    5:  "numeric",   # NUMERIC / DECIMAL / MONEY
    6:  "float",
    7:  "real",
    8:  "float",
    9:  "nvarchar",  # CHAR / VARCHAR / NCHAR / NVARCHAR / TEXT / NTEXT
    10: "nvarchar",
    11: "datetime",  # DATETIME / SMALLDATETIME / DATE / TIME / DATETIME2
    12: "datetime",
    13: "date",
    14: "time",
    16: "uniqueidentifier",
    17: "nvarchar",  # XML
    18: "nvarchar",  # IMAGE / BINARY / VARBINARY (string repr)
    19: "bigint",
    20: "datetime",
    21: "datetime2",
}


def _to_mssql_safe(value: Any, target_type: Optional[str] = None) -> Any:
    """
    BQ / Python değerlerini pymssql'in kabul ettiği tiplere dönüştürür.
    target_type: MSSQL kolon tipi (INFORMATION_SCHEMA.DATA_TYPE, küçük harf)

    Kural özeti:
    - None              → None
    - bool              → int (1/0)
    - Decimal           → int veya float (hedefe göre)
    - datetime/date     → doğrudan Python nesnesi (pymssql datetime anlıyor,
                          string'e çevirme — T harfi içeren ISO format MSSQL'i bozuyor)
    - datetime → numeric/string hedef → uygun dönüşüm
    - list/dict         → JSON string
    - bytes             → utf-8 string
    - string → numeric  → sayıya çevir; boş/null → NULL
    - string → date     → MSSQL'in anlayacağı formata çevir (T'yi boşlukla değiştir)
    """
    if value is None:
        return None

    if isinstance(value, bool):
        return int(value)

    if isinstance(value, decimal.Decimal):
        t = (target_type or "").lower()
        return int(value) if t in _INT_TYPES else float(value)

    t_lower = (target_type or "").lower()

    # Python datetime/date/time nesneleri
    if isinstance(value, datetime.datetime):
        if t_lower in _NUMERIC_TYPES:
            return None  # datetime → sayı → anlamsız, NULL yap
        if t_lower in _STRING_TYPES:
            # "YYYY-MM-DD HH:MM:SS.ffffff" — T harfi yok, MSSQL okur
            return value.strftime("%Y-%m-%d %H:%M:%S")
        # date/datetime/datetime2/smalldatetime veya tip bilinmiyor:
        # pymssql Python datetime nesnesini doğrudan kabul eder — string'e çevirme
        return value

    if isinstance(value, datetime.date):
        if t_lower in _NUMERIC_TYPES:
            return None
        if t_lower in _STRING_TYPES:
            return value.strftime("%Y-%m-%d")
        # date kolonu ya da bilinmiyor: doğrudan nesne gönder
        return value

    if isinstance(value, datetime.time):
        if t_lower in _NUMERIC_TYPES:
            return None
        # time → string (HH:MM:SS)
        return value.strftime("%H:%M:%S")

    if isinstance(value, (list, dict)):
        import json as _json
        return _json.dumps(value, default=str)

    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")

    # String değer → hedef numeric ise sayıya çevir
    if t_lower in _NUMERIC_TYPES and isinstance(value, str):
        v = value.strip()
        if v == "" or v.lower() in ("null", "none", "nan", "-", "n/a"):
            return None
        try:
            return int(float(v)) if t_lower in _INT_TYPES else float(v)
        except (ValueError, TypeError):
            return None  # Çevrilemeyen → NULL

    # String değer → hedef date/datetime ise "T" harfini boşlukla değiştir
    # ("2024-01-15T10:30:00" → "2024-01-15 10:30:00" — MSSQL bunu kabul eder)
    if t_lower in _DATE_TYPES and isinstance(value, str):
        v = value.strip()
        if not v or v.lower() in ("null", "none", "nan", "-", "n/a"):
            return None
        # ISO 8601 T → boşluk
        return v.replace("T", " ").split("+")[0].split("Z")[0].rstrip()

    return value


class MssqlConnector(BaseConnector):
    def __init__(self, config: dict):
        self.config = config

    def _get_connection(self) -> pymssql.Connection:
        c = self.config
        return pymssql.connect(
            server=c["host"],
            port=int(c.get("port", 1433)),
            database=c["database"],
            user=c["username"],
            password=c["password"],
            login_timeout=10,
            tds_version="7.4",
        )

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
            WHERE t.TABLE_SCHEMA = %s AND t.TABLE_TYPE = 'BASE TABLE'
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
            WHERE c.TABLE_SCHEMA = %s AND c.TABLE_NAME = %s
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
        cursor = conn.cursor(as_dict=True)

        columns_meta = self.get_columns(schema, table)

        safe_schema = schema.replace("]", "]]")
        safe_table = table.replace("]", "]]")
        cursor.execute(f"SELECT TOP {limit} * FROM [{safe_schema}].[{safe_table}]")

        rows = list(cursor.fetchall())
        cursor.close()
        conn.close()

        return {"columns": columns_meta, "rows": rows, "total_rows": len(rows)}

    def execute_query_preview(self, query: str, limit: int = 100) -> dict:
        conn = self._get_connection()
        cursor = conn.cursor(as_dict=False)

        wrapped = f"SELECT TOP {limit} * FROM ({query}) AS preview_subquery"
        try:
            cursor.execute(wrapped)
        except Exception:
            cursor.execute(query)

        col_names = [desc[0] for desc in cursor.description]
        col_types = []
        for desc in cursor.description:
            type_code = desc[1]
            # pymssql type_code: int (örn. 5=numeric, 2=int, 11=datetime, 9=nvarchar)
            if isinstance(type_code, int):
                col_types.append(_PYMSSQL_TYPE_MAP.get(type_code, f"type_{type_code}"))
            elif hasattr(type_code, "__name__"):
                col_types.append(type_code.__name__.lower())
            else:
                col_types.append(str(type_code))
        raw_rows = cursor.fetchmany(limit)
        rows = [dict(zip(col_names, row)) for row in raw_rows]

        columns = [
            {
                "name": name,
                "data_type": dtype,
                "nullable": True,
                "max_length": None,
                "is_primary_key": False,
            }
            for name, dtype in zip(col_names, col_types)
        ]

        cursor.close()
        conn.close()

        return {"columns": columns, "rows": rows, "total_rows": len(rows)}

    def read_chunks(
        self, query: str, chunk_size: int = 5000
    ) -> Generator[list[dict[str, Any]], None, None]:
        conn = self._get_connection()
        cursor = conn.cursor(as_dict=True)
        cursor.execute(query)

        while True:
            rows = cursor.fetchmany(chunk_size)
            if not rows:
                break
            yield list(rows)

        cursor.close()
        conn.close()

    def get_column_types(self, schema: str, table: str) -> dict[str, str]:
        """Hedef tablonun kolon adı → DATA_TYPE haritasını döner. Cache için ayrı metot."""
        conn = self._get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
            (schema, table),
        )
        result = {name: dtype.lower() for name, dtype in cur.fetchall()}
        cur.close()
        conn.close()
        return result

    def write_chunk(
        self,
        schema: str,
        table: str,
        rows: list[dict[str, Any]],
        mode: str = "append",
        col_type_map: Optional[dict[str, str]] = None,
        on_error: str = "rollback",   # "rollback" | "continue"
        batch_size: int = 500,        # multi-row VALUES batch boyutu
    ) -> int:
        """
        Rows listesini hedef tabloya yazar.

        Performans stratejisi:
        - Tek seferde çok satırlı INSERT: INSERT INTO t (c1,c2) VALUES (r1),(r2),...
          → executemany'ye göre 5-15x daha hızlı (network round-trip azaltır)
        - batch_size: her multi-row INSERT'teki satır sayısı (500 iyi denge noktası)
        - col_type_map dışarıdan verilirse meta sorgu atlanır (session cache için)

        on_error:
        - "rollback" : herhangi bir batch hata verirse tüm write_chunk işlemi geri alınır
        - "continue" : hatalı batch atlanır, diğerleri yazılmaya devam eder
        """
        if not rows:
            return 0

        safe_schema = schema.replace("]", "]]")
        safe_table = table.replace("]", "]]")
        full_table = f"[{safe_schema}].[{safe_table}]"
        columns = list(rows[0].keys())
        safe_cols = ", ".join(f"[{c.replace(']', ']]')}]" for c in columns)
        col_count = len(columns)

        # Kolon tip haritası (dışarıdan verilmemişse çek)
        if col_type_map is None:
            try:
                col_type_map = self.get_column_types(schema, table)
            except Exception as meta_err:
                logger.warning(f"Kolon tip bilgisi alınamadı ({schema}.{table}): {meta_err}")
                col_type_map = {}

        # Tüm satırları dönüştür
        converted: list[tuple] = [
            tuple(_to_mssql_safe(row.get(c), col_type_map.get(c)) for c in columns)
            for row in rows
        ]

        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            if mode == "overwrite":
                cursor.execute(f"TRUNCATE TABLE {full_table}")

            # Multi-row batch INSERT
            placeholders_single = "(" + ", ".join(["%s"] * col_count) + ")"
            total_written = 0
            skipped = 0

            for batch_start in range(0, len(converted), batch_size):
                batch = converted[batch_start : batch_start + batch_size]
                # "INSERT INTO t (c1,c2) VALUES (%s,%s), (%s,%s), ..."
                multi_placeholders = ", ".join([placeholders_single] * len(batch))
                insert_sql = f"INSERT INTO {full_table} ({safe_cols}) VALUES {multi_placeholders}"
                # Tüm tuple'ları düzleştir
                flat_values = [v for row in batch for v in row]

                try:
                    cursor.execute(insert_sql, flat_values)
                    total_written += len(batch)
                except Exception as batch_err:
                    if on_error == "rollback":
                        conn.rollback()
                        raise  # Üst katmana ilet
                    else:
                        # continue: bu batch'i atla, logla
                        logger.warning(
                            f"Batch atlandı ({batch_start}–{batch_start+len(batch)}): {batch_err}"
                        )
                        skipped += len(batch)

            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
        finally:
            cursor.close()
            conn.close()

        if skipped:
            logger.warning(f"{skipped} satır hata nedeniyle atlandı ({schema}.{table})")
        return total_written

    def execute_non_query(self, sql: str) -> int:
        """INSERT / UPDATE / DELETE / TRUNCATE / DDL sorgularını çalıştırır."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                affected = cur.rowcount if cur.rowcount is not None else -1
            conn.commit()
            return affected
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def close(self):
        pass  # Bağlantılar her işlemde açılıp kapatılıyor
