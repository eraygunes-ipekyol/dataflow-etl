"""
Authentication servisi.
Şifre hashing (bcrypt), JWT token oluşturma/doğrulama, kullanıcı CRUD.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone, timedelta
from app.utils.timezone import now_istanbul
from typing import Optional

import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.utils.logger import logger

# passlib bcrypt context
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Şifre ────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ─── JWT ──────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    """Token'ı decode eder. Geçersiz/süresi dolmuşsa None döner."""
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        logger.warning("JWT süresi dolmuş")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("Geçersiz JWT: %s", e)
        return None


# ─── User CRUD ────────────────────────────────────────────────────────────

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.get(User, user_id)


def list_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.created_at).all()


def create_user(
    db: Session,
    username: str,
    password: str,
    role: str = "user",
    email: Optional[str] = None,
) -> User:
    if get_user_by_username(db, username):
        raise ValueError(f"Kullanıcı adı zaten kullanılıyor: {username}")
    user = User(
        id=uuid.uuid4().hex,
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Yeni kullanıcı oluşturuldu: %s (%s)", username, role)
    return user


def change_password(db: Session, user_id: str, new_password: str) -> Optional[User]:
    user = db.get(User, user_id)
    if not user:
        return None
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    user.updated_at = now_istanbul()
    db.commit()
    db.refresh(user)
    return user


def set_user_active(db: Session, user_id: str, is_active: bool) -> Optional[User]:
    user = db.get(User, user_id)
    if not user:
        return None
    user.is_active = is_active
    user.updated_at = now_istanbul()
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: str) -> bool:
    user = db.get(User, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


# ─── Default admin ────────────────────────────────────────────────────────

def ensure_default_admin(db: Session) -> None:
    """
    Uygulama ilk başladığında users tablosu boşsa
    rastgele şifreli superadmin oluşturur ve şifreyi konsola yazdırır.
    İlk girişte şifre değiştirme zorunludur.
    """
    count = db.query(User).count()
    if count == 0:
        random_password = secrets.token_urlsafe(12)
        user = create_user(db, username="admin", password=random_password, role="superadmin")
        user.must_change_password = True
        db.commit()
        logger.info("=" * 60)
        logger.info("VARSAYILAN SUPERADMIN OLUŞTURULDU")
        logger.info("  Kullanıcı adı : admin")
        logger.info("  Şifre          : %s", random_password)
        logger.info("  İlk girişte şifre değiştirmeniz zorunludur!")
        logger.info("=" * 60)
