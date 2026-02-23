"""
Workflow presence (aktif kullanıcı) servisi.
In-memory store — DB gerektirmez, backend restart'ta otomatik temizlenir.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from threading import Lock

HEARTBEAT_TIMEOUT_SECONDS = 30  # 30 saniye heartbeat gelmezse stale sayılır


@dataclass
class PresenceEntry:
    user_id: str
    username: str
    joined_at: float = field(default_factory=time.time)
    last_heartbeat: float = field(default_factory=time.time)


class PresenceStore:
    """Thread-safe in-memory presence store."""

    def __init__(self) -> None:
        self._lock = Lock()
        # workflow_id -> {user_id: PresenceEntry}
        self._store: dict[str, dict[str, PresenceEntry]] = {}

    def heartbeat(self, workflow_id: str, user_id: str, username: str) -> None:
        """Kullanıcının varlığını bildir veya güncelle."""
        with self._lock:
            if workflow_id not in self._store:
                self._store[workflow_id] = {}
            wf = self._store[workflow_id]
            if user_id in wf:
                wf[user_id].last_heartbeat = time.time()
            else:
                wf[user_id] = PresenceEntry(
                    user_id=user_id,
                    username=username,
                )

    def leave(self, workflow_id: str, user_id: str) -> None:
        """Kullanıcıyı workflow'dan çıkar."""
        with self._lock:
            wf = self._store.get(workflow_id)
            if wf and user_id in wf:
                del wf[user_id]
                if not wf:
                    del self._store[workflow_id]

    def get_active_users(self, workflow_id: str) -> list[dict]:
        """Workflow'daki aktif kullanıcıları döner. Stale olanları temizler."""
        now = time.time()
        with self._lock:
            wf = self._store.get(workflow_id)
            if not wf:
                return []

            active = []
            stale_ids = []
            for uid, entry in wf.items():
                if now - entry.last_heartbeat > HEARTBEAT_TIMEOUT_SECONDS:
                    stale_ids.append(uid)
                else:
                    active.append({
                        "user_id": entry.user_id,
                        "username": entry.username,
                        "joined_at": entry.joined_at,
                    })

            # Stale kayıtları temizle
            for uid in stale_ids:
                del wf[uid]
            if not wf:
                del self._store[workflow_id]

            return active


# Singleton instance
presence_store = PresenceStore()
