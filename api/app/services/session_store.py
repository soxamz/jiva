from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

from app.schemas.intake import SessionState

# Keep outside app/ so uvicorn --reload does not restart on every persist.
_RUNTIME_DIR = Path(__file__).resolve().parents[2] / "runtime"
_STORE_PATH = _RUNTIME_DIR / "sessions_store.json"


class SessionStore:
    """File-backed session store so process restarts do not wipe active intakes."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._lock = Lock()
        self._load()

    def _load(self) -> None:
        if not _STORE_PATH.exists():
            return
        try:
            raw = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for sid, payload in raw.items():
                    self._sessions[sid] = SessionState.model_validate(payload)
        except Exception:
            self._sessions = {}

    def _persist_unlocked(self) -> None:
        _RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            sid: session.model_dump(mode="json")
            for sid, session in self._sessions.items()
        }
        _STORE_PATH.write_text(json.dumps(payload), encoding="utf-8")

    def create(self) -> SessionState:
        session = SessionState()
        with self._lock:
            self._sessions[session.session_id] = session
            self._persist_unlocked()
        return session

    def get(self, session_id: str) -> SessionState | None:
        with self._lock:
            self._load()
            return self._sessions.get(session_id)

    def save(self, session: SessionState) -> SessionState:
        with self._lock:
            self._sessions[session.session_id] = session
            self._persist_unlocked()
        return session

    def delete(self, session_id: str) -> bool:
        with self._lock:
            removed = self._sessions.pop(session_id, None) is not None
            if removed:
                self._persist_unlocked()
            return removed


session_store = SessionStore()
