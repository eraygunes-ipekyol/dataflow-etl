"""
Merkezi timezone yardımcı modülü.
Tüm datetime işlemleri bu modül üzerinden yapılmalıdır.
Uygulama genelinde UTC+3 (Europe/Istanbul) kullanılır.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

ISTANBUL = ZoneInfo("Europe/Istanbul")


def now_istanbul() -> datetime:
    """Şu anki zamanı UTC+3 (İstanbul) olarak döndürür."""
    return datetime.now(ISTANBUL)
