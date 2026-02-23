import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.timezone import now_istanbul


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # "superadmin" veya "user"
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_istanbul, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_istanbul,
        onupdate=now_istanbul,
        nullable=False,
    )
