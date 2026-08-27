from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class OCRResult:
    text: str
    provider: str
    model: str

    confidence: float | None = None
    processing_time_ms: float | None = None

    markdown: str | None = None

    blocks: list[dict[str, Any]] = field(
        default_factory=list
    )

    metadata: dict[str, Any] = field(
        default_factory=dict
    )

    success: bool = True
    fallback_used: bool = False


class OCREngine(ABC):

    provider: str = "unknown"

    @abstractmethod
    def process(
        self,
        image_path: str | Path,
    ) -> OCRResult:
        raise NotImplementedError