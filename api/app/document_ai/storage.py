from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID


_ROOT = Path(__file__).resolve().parents[3]
_STORAGE_ROOT = Path(os.getenv("DOCUMENT_AI_STORAGE_ROOT", str(_ROOT / "storage")))
_DOCS_DIR = _STORAGE_ROOT / "documents"
_META_DIR = _STORAGE_ROOT / "meta"
_RESULTS_DIR = _STORAGE_ROOT / "results"
_AUDIT_DIR = _STORAGE_ROOT / "audit"

_ALLOWED_TYPES = {
    "application/pdf": {".pdf"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/jpg": {".jpg", ".jpeg"},
    "image/png": {".png"},
}

_MAX_BYTES = int(float(os.getenv("MAX_UPLOAD_SIZE_MB", "10")) * 1024 * 1024)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def validate_upload(content: bytes, content_type: str | None, filename: str) -> str:
    if not content:
        raise ValueError("Empty file upload")

    if len(content) > _MAX_BYTES:
        raise ValueError(f"File exceeds {_MAX_BYTES // (1024 * 1024)} MB limit")

    suffix = Path(filename or "").suffix.lower()
    normalized = (content_type or "").split(";")[0].strip().lower()

    if normalized in {"image/jpg"}:
        normalized = "image/jpeg"

    if not normalized:
        if suffix == ".pdf":
            normalized = "application/pdf"
        elif suffix in {".jpg", ".jpeg"}:
            normalized = "image/jpeg"
        elif suffix == ".png":
            normalized = "image/png"

    allowed_suffixes = _ALLOWED_TYPES.get(normalized)
    if not allowed_suffixes:
        raise ValueError(f"Unsupported file type: {content_type or filename}")

    if suffix and suffix not in allowed_suffixes:
        raise ValueError("Filename extension does not match content type")

    return normalized


def update_json_path(payload: dict[str, Any], field_path: str, value: Any) -> None:
    parts = [part for part in field_path.split(".") if part]
    if not parts:
        raise ValueError("field_path is required")

    cursor: Any = payload
    for part in parts[:-1]:
        if part.isdigit():
            index = int(part)
            if not isinstance(cursor, list) or index >= len(cursor):
                raise ValueError(f"Invalid field path: {field_path}")
            cursor = cursor[index]
            continue

        if not isinstance(cursor, dict):
            raise ValueError(f"Invalid field path: {field_path}")
        if part not in cursor or not isinstance(cursor[part], (dict, list)):
            cursor[part] = {}
        cursor = cursor[part]

    leaf = parts[-1]
    if leaf.isdigit():
        index = int(leaf)
        if not isinstance(cursor, list) or index >= len(cursor):
            raise ValueError(f"Invalid field path: {field_path}")
        cursor[index] = value
        return

    if not isinstance(cursor, dict):
        raise ValueError(f"Invalid field path: {field_path}")
    cursor[leaf] = value


class LocalStorageBackend:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or _DOCS_DIR
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, document_id: UUID, content: bytes) -> dict[str, str]:
        path = self.root / f"{document_id}.bin"
        path.write_bytes(content)
        return {
            "storage_uri": str(path),
            "encryption": "none",
        }

    def load(self, document_id: UUID) -> bytes:
        path = self.root / f"{document_id}.bin"
        if not path.exists():
            raise FileNotFoundError(f"Document blob not found: {document_id}")
        return path.read_bytes()


class DocumentRepository:
    def __init__(self, root: Path | None = None) -> None:
        base = root or _STORAGE_ROOT
        self.meta_dir = base / "meta" if root is None else root / "meta"
        self.results_dir = base / "results" if root is None else root / "results"
        self.audit_dir = base / "audit" if root is None else root / "audit"
        for directory in (self.meta_dir, self.results_dir, self.audit_dir):
            directory.mkdir(parents=True, exist_ok=True)

    def _meta_path(self, document_id: str) -> Path:
        return self.meta_dir / f"{document_id}.json"

    def _result_path(self, document_id: str) -> Path:
        return self.results_dir / f"{document_id}.json"

    def _audit_path(self, document_id: str) -> Path:
        return self.audit_dir / f"{document_id}.json"

    def put_document(self, document: dict[str, Any]) -> None:
        document_id = str(document["document_id"])
        self._meta_path(document_id).write_text(
            json.dumps(document, indent=2, default=str),
            encoding="utf-8",
        )

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        path = self._meta_path(document_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def put_result(self, document_id: str, result: dict[str, Any]) -> None:
        self._result_path(document_id).write_text(
            json.dumps(result, indent=2, default=str),
            encoding="utf-8",
        )
        # Convenience debug artifact under document_ai/output when present.
        debug_dir = Path(__file__).resolve().parent / "output"
        debug_dir.mkdir(parents=True, exist_ok=True)
        (debug_dir / f"{document_id}.json").write_text(
            json.dumps(result, indent=2, default=str),
            encoding="utf-8",
        )

    def get_result(self, document_id: str) -> dict[str, Any] | None:
        path = self._result_path(document_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def audit(
        self,
        document_id: str,
        action: str,
        actor_id: str | None,
        outcome: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        path = self._audit_path(document_id)
        events: list[dict[str, Any]] = []
        if path.exists():
            events = json.loads(path.read_text(encoding="utf-8"))
        events.append(
            {
                "timestamp": utc_now(),
                "action": action,
                "actor_id": actor_id,
                "outcome": outcome,
                "metadata": metadata or {},
            }
        )
        path.write_text(json.dumps(events, indent=2, default=str), encoding="utf-8")
