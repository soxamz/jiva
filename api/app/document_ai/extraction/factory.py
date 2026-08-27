from __future__ import annotations

import os

from .base import ExtractionEngine
from .mistral import MistralExtractionEngine


def get_extraction_engine(
    provider: str | None = None,
) -> ExtractionEngine:

    selected_provider = (
        provider
        or os.getenv(
            "EXTRACTION_PROVIDER",
            "mistral",
        )
    ).strip().lower()

    if selected_provider == "mistral":
        return MistralExtractionEngine()

    raise ValueError(
        f"Unsupported extraction provider: "
        f"{selected_provider}. "
        f"Supported provider: mistral"
    )