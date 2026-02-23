"""AI yapilandirma ve workflow uretme endpoint'leri."""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ai_settings import AISettings
from app.models.connection import Connection
from app.models.user import User
from app.services import llm_service
from app.utils.auth_deps import get_current_user, require_superadmin
from app.utils.encryption import decrypt_value, encrypt_value
from app.utils.logger import logger

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Pydantic Schemalar ───────────────────────────────────────────────────────


class AISettingsResponse(BaseModel):
    provider: str
    model: str
    api_key_set: bool
    is_enabled: bool


class AISettingsUpdate(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None  # None ise mevcut key korunur
    is_enabled: bool


class AIStatusResponse(BaseModel):
    is_enabled: bool
    provider: str | None = None
    model: str | None = None


class AIProviderResponse(BaseModel):
    id: str
    label: str
    models: list[str]
    custom_model: bool


class AIGenerateRequest(BaseModel):
    prompt: str
    current_workflow: Optional[dict[str, Any]] = None
    workflow_name: Optional[str] = None


class AIGenerateResponse(BaseModel):
    workflow_definition: dict[str, Any]
    explanation: str


class AITestRequest(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None  # None ise DB'deki kayitli key kullanilir


class AITestResponse(BaseModel):
    success: bool
    message: str


class AISummarizeRequest(BaseModel):
    workflow_definition: dict[str, Any]  # {nodes, edges}
    workflow_name: Optional[str] = None


class AISummarizeResponse(BaseModel):
    summary: str
    steps: list[str]
    node_count: int
    edge_count: int


# ── Yardimci ──────────────────────────────────────────────────────────────────


def _get_or_create_settings(db: Session) -> AISettings:
    """Singleton AI ayarlarini getirir, yoksa olusturur."""
    settings = db.query(AISettings).first()
    if not settings:
        settings = AISettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


# ── Endpoint'ler ──────────────────────────────────────────────────────────────


@router.get("/settings", response_model=AISettingsResponse)
def get_ai_settings(
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> AISettingsResponse:
    """AI ayarlarini getirir (sadece superadmin). API key maskelenir."""
    s = _get_or_create_settings(db)
    return AISettingsResponse(
        provider=s.provider,
        model=s.model,
        api_key_set=bool(s.api_key),
        is_enabled=s.is_enabled,
    )


@router.put("/settings", response_model=AISettingsResponse)
def update_ai_settings(
    body: AISettingsUpdate,
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> AISettingsResponse:
    """AI ayarlarini gunceller (sadece superadmin)."""
    # Provider dogrulama
    if body.provider not in llm_service.LLM_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gecersiz saglayici: {body.provider}",
        )

    s = _get_or_create_settings(db)
    s.provider = body.provider
    s.model = body.model
    s.is_enabled = body.is_enabled

    # API key sadece gonderildiyse guncelle
    if body.api_key is not None and body.api_key.strip():
        s.api_key = encrypt_value(body.api_key.strip())

    db.commit()
    db.refresh(s)

    logger.info(f"AI ayarlari guncellendi: provider={s.provider}, model={s.model}, enabled={s.is_enabled}")

    return AISettingsResponse(
        provider=s.provider,
        model=s.model,
        api_key_set=bool(s.api_key),
        is_enabled=s.is_enabled,
    )


@router.get("/status", response_model=AIStatusResponse)
def get_ai_status(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIStatusResponse:
    """AI durumunu getirir (herkes). Hassas bilgi icermez."""
    s = _get_or_create_settings(db)
    if not s.is_enabled:
        return AIStatusResponse(is_enabled=False)
    return AIStatusResponse(
        is_enabled=True,
        provider=s.provider,
        model=s.model,
    )


@router.get("/providers", response_model=list[AIProviderResponse])
def get_ai_providers(
    _user: User = Depends(get_current_user),
) -> list[AIProviderResponse]:
    """Desteklenen LLM saglayicilari ve modelleri doner."""
    return [
        AIProviderResponse(
            id=pid,
            label=pinfo["label"],
            models=pinfo["models"],
            custom_model=pinfo["custom_model"],
        )
        for pid, pinfo in llm_service.LLM_PROVIDERS.items()
    ]


@router.post("/test", response_model=AITestResponse)
async def test_ai_connection(
    body: AITestRequest,
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> AITestResponse:
    """API key ve model baglantisini test eder (sadece superadmin)."""
    if body.provider not in llm_service.LLM_PROVIDERS:
        return AITestResponse(success=False, message=f"Gecersiz saglayici: {body.provider}")

    # Yeni key gonderildiyse onu kullan, yoksa DB'deki kayitli key'i kullan
    api_key = (body.api_key or "").strip()
    if not api_key:
        s = _get_or_create_settings(db)
        if not s.api_key:
            return AITestResponse(success=False, message="API key tanimlanmamis. Once bir API key kaydedin.")
        try:
            api_key = decrypt_value(s.api_key)
        except Exception:
            return AITestResponse(success=False, message="Kayitli API key cozulemedi. Yeni key girin.")

    result = await llm_service.test_api_key(
        provider=body.provider,
        model=body.model,
        api_key=api_key,
    )
    return AITestResponse(success=result["success"], message=result["message"])


@router.post("/generate", response_model=AIGenerateResponse)
async def generate_workflow(
    body: AIGenerateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIGenerateResponse:
    """AI ile workflow olusturur/duzenler."""
    # AI aktif mi kontrol et
    s = _get_or_create_settings(db)
    if not s.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI ozelligi aktif degil. Yonetici tarafindan etkinlestirilmesi gerekiyor.",
        )

    if not s.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key tanimlanmamis. Ayarlar sayfasindan API key giriniz.",
        )

    # Prompt bos mu?
    if not body.prompt or not body.prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt bos olamaz.",
        )

    # Mevcut baglantilari al (sadece id, name, type — kimlik bilgisi ASLA)
    connections = db.query(Connection).filter(Connection.is_active == True).all()
    conn_list = [
        {"id": c.id, "name": c.name, "type": c.type}
        for c in connections
    ]

    # API key'i coz
    try:
        decrypted_key = decrypt_value(s.api_key)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API key cozulemedi. Ayarlardan yeniden giriniz.",
        )

    # LLM cagrisi
    try:
        result = await llm_service.generate_workflow(
            provider=s.provider,
            model=s.model,
            api_key=decrypted_key,
            prompt=body.prompt.strip(),
            connections=conn_list,
            current_workflow=body.current_workflow,
            workflow_name=body.workflow_name,
        )
    except ValueError as e:
        logger.error(f"AI workflow uretim hatasi (ValueError): {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AI yaniti islenemedi: {str(e)}",
        )
    except Exception as e:
        logger.error(f"AI workflow uretim hatasi: {type(e).__name__}: {e}")
        # httpx HTTP hata detayi
        if hasattr(e, "response") and e.response is not None:
            error_detail = llm_service._extract_api_error(e)
        else:
            error_detail = str(e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM API hatasi: {error_detail}",
        )

    return AIGenerateResponse(
        workflow_definition=result["workflow_definition"],
        explanation=result.get("explanation", "Workflow olusturuldu."),
    )


@router.post("/summarize", response_model=AISummarizeResponse)
async def summarize_workflow(
    body: AISummarizeRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AISummarizeResponse:
    """Mevcut workflow'u analiz edip Turkce ozet cikarir."""
    # AI aktif mi kontrol et
    s = _get_or_create_settings(db)
    if not s.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI ozelligi aktif degil. Yonetici tarafindan etkinlestirilmesi gerekiyor.",
        )

    if not s.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key tanimlanmamis. Ayarlar sayfasindan API key giriniz.",
        )

    # Workflow bos mu kontrol et
    nodes = body.workflow_definition.get("nodes", [])
    if not nodes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workflow bos — ozetlenecek bir sey yok.",
        )

    # API key'i coz
    try:
        decrypted_key = decrypt_value(s.api_key)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API key cozulemedi. Ayarlardan yeniden giriniz.",
        )

    # LLM cagrisi
    try:
        result = await llm_service.summarize_workflow(
            provider=s.provider,
            model=s.model,
            api_key=decrypted_key,
            workflow_definition=body.workflow_definition,
            workflow_name=body.workflow_name,
        )
    except ValueError as e:
        logger.error(f"AI ozet hatasi (ValueError): {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AI yaniti islenemedi: {str(e)}",
        )
    except Exception as e:
        logger.error(f"AI ozet hatasi: {type(e).__name__}: {e}")
        if hasattr(e, "response") and e.response is not None:
            error_detail = llm_service._extract_api_error(e)
        else:
            error_detail = str(e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM API hatasi: {error_detail}",
        )

    return AISummarizeResponse(
        summary=result["summary"],
        steps=result["steps"],
        node_count=result["node_count"],
        edge_count=result["edge_count"],
    )
