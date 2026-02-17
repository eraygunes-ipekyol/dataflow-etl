from cryptography.fernet import Fernet

from app.config import settings


def get_fernet() -> Fernet:
    key = settings.encryption_key
    if not key:
        key = Fernet.generate_key().decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(value: str) -> str:
    return get_fernet().encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    return get_fernet().decrypt(value.encode()).decode()
