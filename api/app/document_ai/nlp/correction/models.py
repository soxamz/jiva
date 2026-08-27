from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CorrectionCandidate:
    raw_text: str
    corrected_text: str
    confidence: float
    accepted: bool
    reason: str = ""

    @property
    def candidate(self) -> str:
        return self.corrected_text


@dataclass
class CorrectionResult:
    raw_text: str
    corrected_text: str
    confidence: float
    changed: bool
    requires_review: bool
    corrections: list[CorrectionCandidate] = field(
        default_factory=list
    )

    provider: str = ""
    model: str = ""

    error: str | None = None

    @property
    def original_text(self) -> str:
        return self.raw_text

    @property
    def corrected(self) -> str:
        return self.corrected_text

    @property
    def candidates(self) -> list[CorrectionCandidate]:
        return self.corrections