from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent / 'db' / 'dataflow.db'}"
    encryption_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8443"]
    default_chunk_size: int = 5000
    preview_row_limit: int = 100

    # JWT Authentication
    jwt_secret_key: str = "dataflow-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480  # 8 saat

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
