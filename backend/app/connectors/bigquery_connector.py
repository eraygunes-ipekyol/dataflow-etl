import json
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
            full_table = self._client.get_table(table.reference)
            result.append(
                {
                    "name": table.table_id,
                    "schema_name": schema,
                    "row_count": full_table.num_rows,
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

    def write_chunk(
        self, schema: str, table: str, rows: list[dict[str, Any]], mode: str = "append"
    ) -> int:
        if not rows:
            return 0

        table_ref = f"{self.project_id}.{schema}.{table}"

        write_disposition = (
            bigquery.WriteDisposition.WRITE_TRUNCATE
            if mode == "overwrite"
            else bigquery.WriteDisposition.WRITE_APPEND
        )

        job_config = bigquery.LoadJobConfig(
            write_disposition=write_disposition,
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            autodetect=True,
        )

        # NDJSON formatına çevir ve geçici dosyaya yaz
        ndjson_lines = [json.dumps(row, default=str) for row in rows]
        ndjson_content = "\n".join(ndjson_lines)

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=True
        ) as tmp:
            tmp.write(ndjson_content)
            tmp.flush()

            with open(tmp.name, "rb") as f:
                job = self._client.load_table_from_file(
                    f, table_ref, job_config=job_config
                )
                job.result()  # Tamamlanmasını bekle

        return len(rows)

    def close(self):
        if self._client:
            self._client.close()
