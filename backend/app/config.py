import secrets
from pathlib import Path

from pydantic_settings import BaseSettings

from app.utils.logger import logger

_DEFAULT_JWT_SECRET = "dataflow-secret-change-me-in-production"


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent / 'db' / 'dataflow.db'}"
    encryption_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8462", "https://eros.ipekyol.com.tr:8443"]
    default_chunk_size: int = 5000
    preview_row_limit: int = 100

    # JWT Authentication
    jwt_secret_key: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480  # 8 saat

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()


def ensure_jwt_secret() -> None:
    """Varsayılan JWT secret kullanılıyorsa güvenli rastgele key üretir ve .env'ye yazar."""
    if settings.jwt_secret_key != _DEFAULT_JWT_SECRET:
        return

    new_key = secrets.token_urlsafe(32)
    env_path = Path(__file__).resolve().parent.parent / ".env"

    # .env dosyasını oku veya oluştur
    if env_path.exists():
        content = env_path.read_text(encoding="utf-8")
    else:
        content = ""

    # JWT_SECRET_KEY satırı varsa güncelle, yoksa ekle
    lines = content.splitlines()
    found = False
    for i, line in enumerate(lines):
        if line.startswith("JWT_SECRET_KEY="):
            lines[i] = f"JWT_SECRET_KEY={new_key}"
            found = True
            break

    if not found:
        lines.append(f"JWT_SECRET_KEY={new_key}")

    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # In-memory güncelle
    settings.jwt_secret_key = new_key
    logger.info("Güvenli JWT secret key otomatik üretildi ve .env dosyasına kaydedildi.")
