import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.timezone import now_istanbul


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    folder_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True
    )
    definition: Mapped[str] = mapped_column(
        Text, nullable=False, default='{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Webhook bildirim ayarları
    notification_webhook_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notification_on_failure: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="1")
    notification_on_success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_istanbul, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_istanbul,
        onupdate=now_istanbul,
        nullable=False,
    )

    folder: Mapped[Optional["Folder"]] = relationship("Folder", back_populates="workflows")  # noqa: F821
    executions: Mapped[list["Execution"]] = relationship(  # noqa: F821
        "Execution", back_populates="workflow", cascade="all, delete-orphan"
    )
    schedules: Mapped[list["Schedule"]] = relationship(  # noqa: F821
        "Schedule", back_populates="workflow", cascade="all, delete-orphan"
    )
