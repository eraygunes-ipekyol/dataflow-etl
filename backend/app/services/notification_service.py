"""
Webhook bildirim servisi.
Execution hata/başarı durumlarında dış servislere POST isteği gönderir.
"""
from __future__ import annotations

import asyncio
from typing import Optional

import httpx

from app.utils.logger import logger


async def send_webhook_notification(
    webhook_url: str,
    payload: dict,
    max_retries: int = 3,
) -> bool:
    """
    Webhook URL'sine JSON POST gönderir.
    3 deneme, exponential backoff (1s, 2s, 4s).
    Başarılıysa True döner.
    """
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook_url, json=payload)
                if resp.status_code < 400:
                    logger.info(
                        "Webhook gönderildi [%s]: %s (status %d)",
                        payload.get("event", "?"),
                        webhook_url,
                        resp.status_code,
                    )
                    return True
                logger.warning(
                    "Webhook HTTP hatası [deneme %d/%d]: %s → %d",
                    attempt + 1,
                    max_retries,
                    webhook_url,
                    resp.status_code,
                )
        except Exception as exc:
            logger.warning(
                "Webhook bağlantı hatası [deneme %d/%d]: %s → %s",
                attempt + 1,
                max_retries,
                webhook_url,
                exc,
            )
        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)  # 1s, 2s

    logger.error("Webhook gönderilemedi: %s (tüm denemeler başarısız)", webhook_url)
    return False


def fire_webhook_notification(
    webhook_url: str,
    payload: dict,
) -> None:
    """
    Asenkron webhook gönderimini event loop'a ekler.
    Senkron context'ten çağrılabilir — event loop yoksa yeni bir tane oluşturur.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_webhook_notification(webhook_url, payload))
    except RuntimeError:
        # Event loop yok (thread pool içinde çağrıldık)
        asyncio.run(send_webhook_notification(webhook_url, payload))
