import json
import os
import tempfile
from pathlib import Path
from typing import Any, Generator

from google.cloud import bigquery
from google.oauth2 import service_account

from app.connectors.base import BaseConnector
from app.utils.logger import logger


class BigQueryConnector(BaseConnector):
    def __init__(self, config: dict):
        self.config = config
        self.project_id = config["project_id"]
        self.default_dataset = config.get("dataset", "")
        self._client = self._create_client()

    def _create_client(self) -> bigquery.Client:
        credentials_json = self.config["credentials_json"]

        if isinstance(credentials_json, str):
            cred_dict = json.loads(credentials_json)
        else:
            cred_dict = credentials_json

        credentials = service_account.Credentials.from_service_account_info(cred_dict)
        return bigquery.Client(project=self.project_id, credentials=credentials)

    def test_connection(self) -> dict:
        try:
            query = "SELECT 1 AS test"
            result = self._client.query(query).result()
            list(result)
            return {"success": True, "message": "BigQuery bağlantısı başarılı"}
        except Exception as e:
            logger.error(f"BigQuery bağlantı testi başarısız: {e}")
            return {"success": False, "message": str(e)}

    def get_schemas(self) -> list[str]:
        """BigQuery'de schema = dataset"""
        datasets = list(self._client.list_datasets())
        return [ds.dataset_id for ds in datasets]

    def get_tables(self, schema: str) -> list[dict]:
        dataset_ref = self._client.dataset(schema)
        tables = list(self._client.list_tables(dataset_ref))
        result = []
        for table in tables:
            result.append(
                {
                    "name": table.table_id,
                    "schema_name": schema,
                    "row_count": None,  # Her tablo için ayrı API çağrısı yapmaktan kaçınmak için None
                }
            )
        return result

    def get_columns(self, schema: str, table: str) -> list[dict]:
        table_ref = f"{self.project_id}.{schema}.{table}"
        bq_table = self._client.get_table(table_ref)
        columns = []
        for field in bq_table.schema:
            columns.append(
                {
                    "name": field.name,
                    "data_type": field.field_type,
                    "nullable": field.mode != "REQUIRED",
                    "max_length": field.max_length,
                    "is_primary_key": False,
                }
            )
        return columns

    def preview_data(self, schema: str, table: str, limit: int = 100) -> dict:
        columns = self.get_columns(schema, table)
        query = f"SELECT * FROM `{self.project_id}.{schema}.{table}` LIMIT {limit}"
        result = self._client.query(query).result()

        rows = []
        for row in result:
            rows.append(dict(row.items()))

        return {"columns": columns, "rows": rows, "total_rows": len(rows)}

    def execute_query_preview(self, query: str, limit: int = 100) -> dict:
        wrapped = f"SELECT * FROM ({query}) AS preview_subquery LIMIT {limit}"
        try:
            result = self._client.query(wrapped).result()
        except Exception:
            result = self._client.query(query).result()

        rows = []
        col_names = []
        for row in result:
            if not col_names:
                col_names = list(row.keys())
            rows.append(dict(row.items()))
            if len(rows) >= limit:
                break

        columns = [
            {"name": name, "data_type": "STRING", "nullable": True, "max_length": None, "is_primary_key": False}
            for name in col_names
        ]

        return {"columns": columns, "rows": rows, "total_rows": len(rows)}

    def read_chunks(
        self, query: str, chunk_size: int = 5000
    ) -> Generator[list[dict[str, Any]], None, None]:
        result = self._client.query(query).result(page_size=chunk_size)

        chunk: list[dict[str, Any]] = []
        for row in result:
            chunk.append(dict(row.items()))
            if len(chunk) >= chunk_size:
                yield chunk
                chunk = []

        if chunk:
            yield chunk

    # ── BQ tip dönüşüm yardımcıları ─────────────────────────────────────
    @staticmethod
    def _bq_type_to_python(field_type: str, value: Any) -> Any:
        """BQ alan tipine göre Python değerini dönüştürür (tip uyumsuzluğunu önler)."""
        import decimal as _decimal
        import datetime as _dt

        if value is None:
            return None

        ft = field_type.upper()

        # Tam sayı tipleri
        if ft in ("INTEGER", "INT64", "INT", "SMALLINT", "BIGINT", "TINYINT", "BYTEINT"):
            if isinstance(value, bool):
                return int(value)
            if isinstance(value, (_decimal.Decimal, float)):
                return int(value)
            try:
                return int(float(str(value)))
            except (ValueError, TypeError):
                return None

        # Ondalık tipleri
        if ft in ("FLOAT", "FLOAT64"):
            if isinstance(value, bool):
                return float(int(value))
            try:
                return float(str(value))
            except (ValueError, TypeError):
                return None

        # Yüksek hassasiyetli sayı
        if ft in ("NUMERIC", "BIGNUMERIC", "DECIMAL", "BIGDECIMAL"):
            if isinstance(value, bool):
                return float(int(value))
            try:
                return float(_decimal.Decimal(str(value)))
            except Exception:
                return None

        # Metin
        if ft in ("STRING", "VARCHAR", "CHAR", "BYTES"):
            if isinstance(value, (_dt.datetime, _dt.date, _dt.time)):
                return value.isoformat()
            return str(value)

        # Boolean
        if ft == "BOOL" or ft == "BOOLEAN":
            if isinstance(value, bool):
                return value
            return str(value).lower() in ("1", "true", "yes", "t", "on")

        # Tarih
        if ft == "DATE":
            if isinstance(value, _dt.datetime):
                return value.date().isoformat()
            if isinstance(value, _dt.date):
                return value.isoformat()
            # "20231205" gibi integer → "2023-12-05"
            if isinstance(value, (int, float)):
                s = str(int(value))
                if len(s) == 8:
                    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
                return s
            return str(value)

        # Zaman damgası
        if ft in ("DATETIME", "TIMESTAMP"):
            if isinstance(value, (_dt.datetime, _dt.date)):
                return value.isoformat()
            return str(value)

        # Bilinmeyen tip — string'e çevir
        return str(value) if not isinstance(value, (str, int, float, bool, type(None))) else value

    def _apply_bq_schema_types(
        self, rows: list[dict[str, Any]], bq_table: "bigquery.Table"
    ) -> list[dict[str, Any]]:
        """Satırlardaki değerleri BQ tablo şemasına göre Python tipine dönüştürür."""
        field_map = {f.name: f.field_type for f in bq_table.schema}
        result = []
        for row in rows:
            new_row: dict[str, Any] = {}
            for key, val in row.items():
                ft = field_map.get(key)
                new_row[key] = self._bq_type_to_python(ft, val) if ft else val
            result.append(new_row)
        return result

    def write_chunk(
        self, schema: str, table: str, rows: list[dict[str, Any]], mode: str = "append",
        col_type_map: Any = None, on_error: str = "rollback", batch_size: int = 500,
    ) -> int:
        if not rows:
            return 0

        table_ref_str = f"{self.project_id}.{schema}.{table}"

        write_disposition = (
            bigquery.WriteDisposition.WRITE_TRUNCATE
            if mode == "overwrite"
            else bigquery.WriteDisposition.WRITE_APPEND
        )

        # Mevcut BQ tablo şemasını al → Python tiplerini dönüştür
        try:
            bq_table = self._client.get_table(table_ref_str)
            rows = self._apply_bq_schema_types(rows, bq_table)
            # Mevcut şemayı kullan — tip uyumsuzluğunu engeller
            job_config = bigquery.LoadJobConfig(
                write_disposition=write_disposition,
                source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
                schema=bq_table.schema,
            )
        except Exception as schema_err:
            logger.warning(f"BQ tablo şeması alınamadı, autodetect kullanılıyor: {schema_err}")
            job_config = bigquery.LoadJobConfig(
                write_disposition=write_disposition,
                source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
                autodetect=True,
            )

        # NDJSON formatına çevir
        ndjson_lines = [json.dumps(row, default=str) for row in rows]
        ndjson_content = "\n".join(ndjson_lines)

        # Windows'ta delete=True ile açık dosyayı tekrar açmak Permission denied verir.
        # Bu yüzden delete=False kullanıp, işlem bittikten sonra manuel siliyoruz.
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8")
        try:
            tmp.write(ndjson_content)
            tmp.flush()
            tmp.close()  # Windows'ta başka process açabilmesi için önce kapat

            with open(tmp.name, "rb") as f:
                job = self._client.load_table_from_file(f, table_ref_str, job_config=job_config)
                job.result()  # Tamamlanmasını bekle
        finally:
            try:
                os.unlink(tmp.name)  # Geçici dosyayı temizle
            except OSError:
                pass

        return len(rows)

    def execute_non_query(self, sql: str) -> int:
        """BigQuery üzerinde DML / DDL sorgusu çalıştırır."""
        job = self._client.query(sql)
        job.result()  # Tamamlanmasını bekle
        # DML için num_dml_affected_rows, DDL için None
        affected = job.num_dml_affected_rows
        return affected if affected is not None else -1

    def close(self):
        if self._client:
            self._client.close()
