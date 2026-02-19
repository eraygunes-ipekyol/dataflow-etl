"""
FastAPI dependency injection — JWT auth.
get_current_user: Bearer token'ı doğrular, User nesnesi döner.
require_superadmin: Sadece superadmin rolüne izin verir.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.auth_service import decode_access_token, get_user_by_id

_security = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: Session = Depends(get_db),
) -> User:
    """
    Authorization: Bearer <token> header'ını doğrular.
    Geçerli aktif kullanıcı döner; aksi hâlde 401 fırlatır.
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token geçersiz veya süresi dolmuş",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = payload.get("sub", "")
    user = get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap pasif durumda",
        )

    return user


def require_superadmin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Sadece superadmin rolüne sahip kullanıcılara izin verir."""
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için superadmin yetkisi gereklidir",
        )
    return current_user
