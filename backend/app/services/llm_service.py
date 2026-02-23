"""LLM saglayici servisi — Claude, OpenRouter destegi."""

import json
import re
from pathlib import Path
from typing import Any, Optional

import httpx

from app.utils.logger import logger

# ── Saglayici Tanimlari ──────────────────────────────────────────────────────

LLM_PROVIDERS: dict[str, dict[str, Any]] = {
    "claude": {
        "label": "Claude (Anthropic)",
        "models": [
            "claude-sonnet-4-20250514",
            "claude-3-7-sonnet-20250219",
            "claude-3-5-haiku-20241022",
            "claude-3-5-sonnet-20241022",
            "claude-3-opus-20240229",
        ],
        "custom_model": False,
    },
    "openrouter": {
        "label": "OpenRouter",
        "models": [],
        "custom_model": True,
    },
}

# ── Referans Dokumani ─────────────────────────────────────────────────────────

_workflow_ai_md_cache: Optional[str] = None


def _load_workflow_ai_md() -> str:
    """workflow_ai.md referans dokumanini yukler (cache'li)."""
    global _workflow_ai_md_cache
    if _workflow_ai_md_cache is not None:
        return _workflow_ai_md_cache

    md_path = Path(__file__).resolve().parent.parent.parent / "workflow_ai.md"
    if not md_path.exists():
        logger.warning(f"workflow_ai.md bulunamadi: {md_path}")
        return ""

    _workflow_ai_md_cache = md_path.read_text(encoding="utf-8")
    return _workflow_ai_md_cache


def invalidate_workflow_ai_cache() -> None:
    """workflow_ai.md cache'ini temizler (dosya guncellendiginde)."""
    global _workflow_ai_md_cache
    _workflow_ai_md_cache = None


# ── Prompt Olusturma ──────────────────────────────────────────────────────────


def build_system_prompt(connections: list[dict[str, str]]) -> str:
    """LLM'e gonderilecek system prompt'u olusturur."""
    md_content = _load_workflow_ai_md()

    conn_section = "\n\n## Mevcut Baglantilar\n\n"
    if connections:
        conn_section += "Asagidaki baglantilari `connection_id` olarak kullanabilirsin:\n\n"
        conn_section += "| ID | Ad | Tip |\n|-----|-----|-----|\n"
        for c in connections:
            conn_section += f"| {c['id']} | {c['name']} | {c['type']} |\n"
    else:
        conn_section += "Henuz tanimlanmis baglanti yok. connection_id alanlarini bos birak.\n"

    return md_content + conn_section


def build_user_message(
    prompt: str,
    current_workflow: Optional[dict] = None,
    workflow_name: Optional[str] = None,
) -> str:
    """Kullanici mesajini olusturur."""
    parts = []

    if workflow_name:
        parts.append(f"Workflow adi: {workflow_name}")

    if current_workflow:
        parts.append(
            "Mevcut workflow (bunu dikkate al, uzerine duzenleme yap):\n"
            f"```json\n{json.dumps(current_workflow, ensure_ascii=False, indent=2)}\n```"
        )

    parts.append(f"Istek: {prompt}")

    return "\n\n".join(parts)


# ── JSON Cikarma ──────────────────────────────────────────────────────────────


def _extract_json_from_text(text: str) -> dict:
    """LLM yanitindan JSON objesini cikarir."""
    # Oncelikle ```json ... ``` blogu ara
    json_block = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if json_block:
        return json.loads(json_block.group(1).strip())

    # Direkt JSON parse dene
    text = text.strip()
    # Ilk { ile son } arasini al
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("LLM yanitindan gecerli JSON cikarilamadi")


# ── HTTP Hata Ayiklama ───────────────────────────────────────────────────────


def _extract_api_error(exc: httpx.HTTPStatusError) -> str:
    """HTTP hata yanitindan anlasilir mesaj cikarir."""
    status_code = exc.response.status_code
    try:
        body = exc.response.json()
    except Exception:
        return f"HTTP {status_code}: {exc.response.text[:300]}"

    # OpenRouter formati: {"error": {"message": "..."}}
    if "error" in body:
        err = body["error"]
        if isinstance(err, dict):
            return err.get("message", str(err))
        return str(err)

    # Claude formati: {"message": "..."}
    if "message" in body:
        return body["message"]

    return f"HTTP {status_code}: {json.dumps(body, ensure_ascii=False)[:300]}"


# ── Saglayici Istemcileri ─────────────────────────────────────────────────────

TIMEOUT = httpx.Timeout(120.0, connect=15.0)
TEST_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


async def _call_claude(
    api_key: str, model: str, system_prompt: str, user_message: str
) -> str:
    """Anthropic Claude API cagrisi."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 8192,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        # Claude yaniti content bloklari icinde gelir
        for block in data.get("content", []):
            if block.get("type") == "text":
                return block["text"]
        raise ValueError("Claude yanitinda text blogu bulunamadi")


async def _call_openrouter(
    api_key: str, model: str, system_prompt: str, user_message: str
) -> str:
    """OpenRouter API cagrisi (OpenAI uyumlu)."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ── API Key Test Fonksiyonlari ───────────────────────────────────────────────


async def test_api_key(provider: str, model: str, api_key: str) -> dict[str, Any]:
    """
    API key'in gecerli olup olmadigini test eder.
    Basit bir istek gonderip sonucu doner.

    Returns:
        {"success": True/False, "message": "...", "model": "..."}
    """
    try:
        if provider == "claude":
            async with httpx.AsyncClient(timeout=TEST_TIMEOUT) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "max_tokens": 5,
                        "messages": [{"role": "user", "content": "Merhaba, test."}],
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                used_model = data.get("model", model)
                return {"success": True, "message": f"Baglanti basarili! Model: {used_model}", "model": used_model}

        elif provider == "openrouter":
            async with httpx.AsyncClient(timeout=TEST_TIMEOUT) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "Merhaba, test."}],
                        "max_tokens": 5,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                used_model = data.get("model", model)
                return {"success": True, "message": f"Baglanti basarili! Model: {used_model}", "model": used_model}
        else:
            return {"success": False, "message": f"Desteklenmeyen saglayici: {provider}"}

    except httpx.HTTPStatusError as e:
        error_msg = _extract_api_error(e)
        return {"success": False, "message": error_msg}
    except httpx.ConnectError:
        return {"success": False, "message": "Baglanti kurulamadi. Internet baglantinizi kontrol edin."}
    except httpx.TimeoutException:
        return {"success": False, "message": "Istek zaman asimina ugradi. Lutfen tekrar deneyin."}
    except Exception as e:
        return {"success": False, "message": f"Beklenmeyen hata: {str(e)}"}


# ── Ana Fonksiyon ─────────────────────────────────────────────────────────────

_PROVIDER_CALLERS = {
    "claude": _call_claude,
    "openrouter": _call_openrouter,
}


async def generate_workflow(
    provider: str,
    model: str,
    api_key: str,
    prompt: str,
    connections: list[dict[str, str]],
    current_workflow: Optional[dict] = None,
    workflow_name: Optional[str] = None,
) -> dict:
    """
    LLM'den workflow uretir.

    Returns:
        {"workflow_definition": {...}, "explanation": "..."}

    Raises:
        ValueError: Gecersiz provider veya JSON parse hatasi
        httpx.HTTPStatusError: API hatasi
    """
    caller = _PROVIDER_CALLERS.get(provider)
    if not caller:
        raise ValueError(f"Desteklenmeyen LLM saglayicisi: {provider}")

    system_prompt = build_system_prompt(connections)
    user_message = build_user_message(prompt, current_workflow, workflow_name)

    logger.info(f"LLM cagrisi baslatiliyor: provider={provider}, model={model}")

    raw_response = await caller(api_key, model, system_prompt, user_message)

    logger.info(f"LLM yaniti alindi ({len(raw_response)} karakter)")

    # JSON parse
    result = _extract_json_from_text(raw_response)

    # Temel dogrulama
    if "workflow_definition" not in result:
        # Belki direkt definition donmustur
        if "nodes" in result and "edges" in result:
            result = {
                "workflow_definition": result,
                "explanation": result.get("explanation", "Workflow olusturuldu."),
            }
        else:
            raise ValueError(
                "LLM yaniti 'workflow_definition' alani icermiyor"
            )

    wd = result["workflow_definition"]
    if "nodes" not in wd or "edges" not in wd:
        raise ValueError("workflow_definition icinde 'nodes' veya 'edges' eksik")

    # Varsayilan viewport
    if "viewport" not in wd:
        wd["viewport"] = {"x": 0, "y": 0, "zoom": 1}

    # explanation yoksa ekle
    if "explanation" not in result:
        result["explanation"] = "Workflow basariyla olusturuldu."

    return result


# ── Workflow Ozet Fonksiyonu ──────────────────────────────────────────────────

_SUMMARIZE_SYSTEM_PROMPT = """\
Sen bir ETL workflow analiz uzmanisin. Sana verilen workflow JSON'unu inceleyip Turkce ozet cikart.

Cikti formati (JSON):
{
  "summary": "Bu workflow ... yapar.",
  "steps": ["Adim aciklamasi 1", "Adim aciklamasi 2", ...]
}

Kurallar:
- Ozet 2-4 cumle olsun, teknik ama anlasilir
- Her adimi kisa ve net acikla (node sirasi takip edilmeli)
- Node tiplerini Turkce cevir: SOURCE=Kaynak, DESTINATION=Hedef, TRANSFORM=Donusum, FILTER=Filtre, JOIN=Birlestirme, SQL_EXECUTE=SQL Calistir, WORKFLOW_REF=Alt Workflow
- Tablo adlarini, kolon adlarini ve baglanti bilgilerini ozetde belirt
- Sadece JSON dondur, baska bir sey yazma
"""

SUMMARIZE_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


async def _call_claude_light(
    api_key: str, model: str, system_prompt: str, user_message: str
) -> str:
    """Claude API cagrisi — ozet icin hafif parametreler."""
    async with httpx.AsyncClient(timeout=SUMMARIZE_TIMEOUT) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}],
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        for block in data.get("content", []):
            if block.get("type") == "text":
                return block["text"]
        raise ValueError("Claude yanitinda text blogu bulunamadi")


async def _call_openrouter_light(
    api_key: str, model: str, system_prompt: str, user_message: str
) -> str:
    """OpenRouter API cagrisi — ozet icin hafif parametreler."""
    async with httpx.AsyncClient(timeout=SUMMARIZE_TIMEOUT) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": 1024,
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


_SUMMARIZE_CALLERS = {
    "claude": _call_claude_light,
    "openrouter": _call_openrouter_light,
}


async def summarize_workflow(
    provider: str,
    model: str,
    api_key: str,
    workflow_definition: dict,
    workflow_name: Optional[str] = None,
) -> dict:
    """
    Workflow JSON'unu analiz edip Turkce ozet cikarir.

    Returns:
        {"summary": "...", "steps": [...], "node_count": N, "edge_count": N}

    Raises:
        ValueError: Gecersiz provider veya JSON parse hatasi
        httpx.HTTPStatusError: API hatasi
    """
    caller = _SUMMARIZE_CALLERS.get(provider)
    if not caller:
        raise ValueError(f"Desteklenmeyen LLM saglayicisi: {provider}")

    # User message olustur
    parts = []
    if workflow_name:
        parts.append(f"Workflow adi: {workflow_name}")
    parts.append(
        f"Workflow JSON:\n```json\n{json.dumps(workflow_definition, ensure_ascii=False, indent=2)}\n```"
    )
    user_message = "\n\n".join(parts)

    node_count = len(workflow_definition.get("nodes", []))
    edge_count = len(workflow_definition.get("edges", []))

    logger.info(
        f"Workflow ozet cagrisi baslatiliyor: provider={provider}, model={model}, "
        f"nodes={node_count}, edges={edge_count}"
    )

    raw_response = await caller(api_key, model, _SUMMARIZE_SYSTEM_PROMPT, user_message)

    logger.info(f"Ozet yaniti alindi ({len(raw_response)} karakter)")

    # JSON parse
    result = _extract_json_from_text(raw_response)

    summary = result.get("summary", "Workflow ozeti olusturulamadi.")
    steps = result.get("steps", [])
    if not isinstance(steps, list):
        steps = []

    return {
        "summary": summary,
        "steps": steps,
        "node_count": node_count,
        "edge_count": edge_count,
    }
