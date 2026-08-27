from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .schema import ABDMExtractionResult


class ExtractionEngine(ABC):
    """
    Base interface for clinical extraction engines.

    Extraction receives:
        - corrected OCR text
        - optional OCR blocks
        - original raw OCR text
        - accepted OCR correction history

    The corrected OCR text is the primary extraction source.
    """

    @abstractmethod
    def extract(
        self,
        ocr_text: str,
        ocr_blocks: list[dict[str, Any]] | None = None,
        *,
        raw_ocr_text: str | None = None,
        corrections: list[dict[str, Any]] | None = None,
    ) -> ABDMExtractionResult:
        raise NotImplementedError