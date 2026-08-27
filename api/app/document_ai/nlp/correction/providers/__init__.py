from __future__ import annotations

import os

from .base import CorrectionProvider


def get_correction_provider(
    provider: str | None = None,
) -> CorrectionProvider:
    """Resolve OCR correction provider.

    Lazy-imports provider modules so optional deps (e.g. xai_sdk for grok)
    are only required when that provider is selected.
    """

    name = (
        provider
        or os.getenv("OCR_CORRECTION_PROVIDER")
        or os.getenv("CORRECTION_PROVIDER")
        or "gemini"
    ).strip().lower()

    if name == "gemini":
        from .gemini import GeminiCorrectionProvider

        return GeminiCorrectionProvider()

    if name == "grok":
        from .grok import GrokCorrectionProvider

        return GrokCorrectionProvider()

    if name == "groq":
        from .groq import GroqCorrectionProvider

        return GroqCorrectionProvider()

    raise ValueError(
        f"Unsupported OCR correction provider: {name}"
    )


__all__ = [
    "CorrectionProvider",
    "get_correction_provider",
]
