from abc import ABC, abstractmethod
from typing import Any, Generator


class BaseConnector(ABC):
    """Tüm veri kaynağı/hedef bağlayıcılarının soyut temel sınıfı."""

    @abstractmethod
    def test_connection(self) -> dict:
        """Bağlantıyı test eder. {"success": bool, "message": str} döner."""
        ...

    @abstractmethod
    def get_schemas(self) -> list[str]:
        """Veritabanındaki şema listesini döner."""
        ...

    @abstractmethod
    def get_tables(self, schema: str) -> list[dict]:
        """Belirtilen şemadaki tablo listesini döner. [{"name": str, "schema_name": str, "row_count": int|None}]"""
        ...

    @abstractmethod
    def get_columns(self, schema: str, table: str) -> list[dict]:
        """Tablo kolon bilgilerini döner. [{"name": str, "data_type": str, "nullable": bool, ...}]"""
        ...

    @abstractmethod
    def preview_data(self, schema: str, table: str, limit: int = 100) -> dict:
        """Tablodan önizleme verisi çeker. {"columns": [...], "rows": [...], "total_rows": int}"""
        ...

    @abstractmethod
    def execute_query_preview(self, query: str, limit: int = 100) -> dict:
        """SQL sorgusu ile önizleme verisi çeker."""
        ...

    @abstractmethod
    def read_chunks(
        self, query: str, chunk_size: int = 5000
    ) -> Generator[list[dict[str, Any]], None, None]:
        """Streaming okuma — chunk chunk yield eder. Bellek dostu."""
        ...

    @abstractmethod
    def write_chunk(
        self, schema: str, table: str, rows: list[dict[str, Any]], mode: str = "append"
    ) -> int:
        """Bir chunk yazar, yazılan satır sayısını döner."""
        ...

    def execute_non_query(self, sql: str) -> int:
        """
        SELECT dışı (INSERT/UPDATE/DELETE/TRUNCATE/DDL) sorgu çalıştırır.
        Etkilenen satır sayısını döner (-1 = bilinmiyor).
        Alt sınıflar override etmeli; varsayılan NotImplementedError fırlatır.
        """
        raise NotImplementedError(f"{type(self).__name__} execute_non_query desteklemiyor")

    def close(self):
        """Bağlantıyı kapat. Alt sınıflar override edebilir."""
        pass
