from __future__ import annotations

import os

from .base import OCREngine
from .mistral_ocr_engine import MistralOCREngine


def get_ocr_engine(
    provider: str | None = None,
) -> OCREngine:

    selected_provider = (
        provider
        or os.getenv(
            "OCR_PROVIDER",
            "mistral",
        )
    ).strip().lower()

    if selected_provider == "mistral":
        return MistralOCREngine()

    raise ValueError(
        f"Unsupported OCR provider: {selected_provider}. "
        "Supported provider: mistral"
    )