from __future__ import annotations

import os

from .base import CorrectionProvider
from .gemini import GeminiCorrectionProvider
from .grok import GrokCorrectionProvider
from .groq import GroqCorrectionProvider


def get_correction_provider(
    provider: str | None = None,
) -> CorrectionProvider:

    name = (
        provider
        or os.getenv(
            "OCR_CORRECTION_PROVIDER",
            "gemini",
        )
    ).strip().lower()

    if name == "gemini":
        return GeminiCorrectionProvider()

    if name == "grok":
        return GrokCorrectionProvider()

    if name == "groq":
        return GroqCorrectionProvider()

    raise ValueError(
        f"Unsupported OCR correction provider: {name}"
    )


__all__ = [
    "CorrectionProvider",
    "GeminiCorrectionProvider",
    "GrokCorrectionProvider",
    "GroqCorrectionProvider",
    "get_correction_provider",
]