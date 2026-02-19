from typing import Optional
from cryptography.fernet import Fernet

from app.config import settings


_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet
    key = settings.encryption_key
    if not key:
        # .env yoksa uygulama ömrü boyunca sabit bir key üret (yeniden başlatmada sıfırlanır)
        key = Fernet.generate_key().decode()
        settings.encryption_key = key
    _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_value(value: str) -> str:
    return get_fernet().encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    return get_fernet().decrypt(value.encode()).decode()
