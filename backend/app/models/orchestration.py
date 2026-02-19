import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.timezone import now_istanbul


class Orchestration(Base):
    """
    Birden fazla workflow'u sırayla veya koşullu çalıştıran orkestrasyon planı.
    Her plan bir cron expression ile tetiklenir.
    """
    __tablename__ = "orchestrations"

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Hata politikası: "stop" = ilk hata durur, "continue" = devam eder
    on_error: Mapped[str] = mapped_column(String(20), default="stop", nullable=False)

    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_istanbul, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_istanbul,
        onupdate=now_istanbul,
        nullable=False,
    )

    steps: Mapped[list["OrchestrationStep"]] = relationship(
        "OrchestrationStep",
        back_populates="orchestration",
        cascade="all, delete-orphan",
        order_by="OrchestrationStep.order_index",
    )


class OrchestrationStep(Base):
    """
    Orkestrasyon içindeki tek bir adım (workflow çalıştırma).
    retry_count: Başarısız olursa kaç kez tekrar denenir.
    timeout_seconds: Bu adım için maksimum süre (0 = sınırsız).
    on_failure: "stop" = orkestrasyon durur, "continue" = sonraki adıma geçer.
    """
    __tablename__ = "orchestration_steps"

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    orchestration_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("orchestrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workflow_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Yeniden deneme
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    retry_delay_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    # Zaman aşımı (saniye, 0 = sınırsız)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Bu adım başarısız olursa: stop | continue
    on_failure: Mapped[str] = mapped_column(String(20), default="stop", nullable=False)

    orchestration: Mapped["Orchestration"] = relationship("Orchestration", back_populates="steps")
    workflow: Mapped["Workflow"] = relationship("Workflow")  # noqa: F821
