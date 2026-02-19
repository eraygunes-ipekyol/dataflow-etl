from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.timezone import now_istanbul


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Kimin yaptığı — user silinse de kayıt kalır (username snapshot)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    username: Mapped[str] = mapped_column(String(50), nullable=False, default="system")

    # Ne yapıldı
    action: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # "create" | "update" | "delete" | "restore" | "login"

    # Hangi entity
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # "workflow" | "schedule" | "orchestration" | "connection" | "folder" | "user"

    entity_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    entity_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Önceki ve yeni değer (JSON string)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # İstek IP adresi
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # UTC+3 İstanbul saatine göre kayıt zamanı
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_istanbul,
        nullable=False,
        index=True,
    )
