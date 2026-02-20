"""
Auth router — login, profil, kullanıcı yönetimi (superadmin).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForceChangePasswordRequest,
    LoginRequest,
    SetActiveRequest,
    TokenResponse,
    UserCreate,
    UserInfo,
    UserResponse,
)
from app.services import audit_service, auth_service
from app.utils.auth_deps import get_current_user, require_superadmin

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ─── Public ───────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = auth_service.get_user_by_username(db, data.username)

    if not user or not auth_service.verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap pasif durumda. Yöneticiye başvurun.",
        )

    token = auth_service.create_access_token(user.id, user.username, user.role)

    # Login audit log
    audit_service.log_action(
        db,
        user_id=user.id,
        username=user.username,
        action="login",
        entity_type="user",
        entity_id=user.id,
        entity_name=user.username,
        ip_address=_get_client_ip(request),
    )

    return TokenResponse(
        access_token=token,
        user=UserInfo.model_validate(user),
        must_change_password=user.must_change_password,
    )


# ─── Authenticated ─────────────────────────────────────────────────────────

@router.get("/me", response_model=UserInfo)
def me(current_user: User = Depends(get_current_user)):
    return UserInfo.model_validate(current_user)


@router.post("/change-password", status_code=200)
def change_own_password(
    data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kullanıcı kendi şifresini değiştirir. current_password zorunlu."""
    if not data.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut şifre gereklidir",
        )
    if not auth_service.verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut şifre hatalı",
        )

    auth_service.change_password(db, current_user.id, data.new_password)

    audit_service.log_action(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="update",
        entity_type="user",
        entity_id=current_user.id,
        entity_name=current_user.username,
        new_value={"info": "Şifre değiştirildi"},
        ip_address=_get_client_ip(request),
    )
    return {"detail": "Şifre başarıyla güncellendi"}


@router.post("/force-change-password", status_code=200)
def force_change_password(
    data: ForceChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """İlk girişte zorunlu şifre değiştirme. current_password gerekmez."""
    if not current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Şifre değiştirme zorunluluğu bulunmuyor",
        )

    auth_service.change_password(db, current_user.id, data.new_password)

    audit_service.log_action(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="update",
        entity_type="user",
        entity_id=current_user.id,
        entity_name=current_user.username,
        new_value={"info": "Zorunlu şifre değişikliği tamamlandı"},
        ip_address=_get_client_ip(request),
    )
    return {"detail": "Şifre başarıyla güncellendi"}


# ─── Superadmin only ───────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    return [UserResponse.model_validate(u) for u in auth_service.list_users(db)]


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    try:
        user = auth_service.create_user(
            db,
            username=data.username,
            password=data.password,
            role=data.role,
            email=data.email,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    audit_service.log_action(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="create",
        entity_type="user",
        entity_id=user.id,
        entity_name=user.username,
        new_value={"role": user.role, "email": user.email},
        ip_address=_get_client_ip(request),
    )
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}/password", status_code=200)
def admin_change_password(
    user_id: str,
    data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Superadmin başka kullanıcının şifresini değiştirir (current_password gerekmez)."""
    user = auth_service.change_password(db, user_id, data.new_password)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    audit_service.log_action(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="update",
        entity_type="user",
        entity_id=user_id,
        entity_name=user.username,
        new_value={"info": "Şifre yönetici tarafından değiştirildi"},
        ip_address=_get_client_ip(request),
    )
    return {"detail": "Şifre başarıyla güncellendi"}


@router.put("/users/{user_id}/active", response_model=UserResponse)
def set_user_active(
    user_id: str,
    data: SetActiveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    # Superadmin kendini pasif yapamaz
    if user_id == current_user.id and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi hesabınızı pasif yapamazsınız",
        )

    user = auth_service.set_user_active(db, user_id, data.is_active)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    audit_service.log_action(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="update",
        entity_type="user",
        entity_id=user_id,
        entity_name=user.username,
        new_value={"is_active": data.is_active},
        ip_address=_get_client_ip(request),
    )
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    # Superadmin kendini silemez
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi hesabınızı silemezsiniz",
        )

    target = auth_service.get_user_by_id(db, user_id)
    target_name = target.username if target else user_id

    ok = auth_service.delete_user(db, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    audit_service.log_action(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="delete",
        entity_type="user",
        entity_id=user_id,
        entity_name=target_name,
        ip_address=_get_client_ip(request),
    )
