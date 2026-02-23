import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AISettings(Base):
    """AI yapilandirma ayarlari — singleton tablo (tek kayit)."""

    __tablename__ = "ai_settings"

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, default="openrouter"
    )  # claude | openrouter
    model: Mapped[str] = mapped_column(
        String(100), nullable=False, default=""
    )
    api_key: Mapped[str] = mapped_column(
        Text, nullable=False, default=""
    )  # Fernet ile sifrelenmis
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
