from __future__ import annotations

import logging
import os
from pathlib import Path

from .base import OCRResult
from .factory import get_ocr_engine


logger = logging.getLogger(__name__)


class OCRRouter:
    """
    OCR routing with Mistral as the primary provider
    and Gemini as the fallback provider.
    """

    def __init__(
        self,
        primary_provider: str | None = None,
        fallback_provider: str | None = None,
    ) -> None:

        self.primary_provider = (
            primary_provider
            or os.getenv(
                "OCR_PROVIDER",
                "mistral",
            )
        )

        self.fallback_provider = (
            fallback_provider
            or "gemini"
        )

        if (
            self.primary_provider
            == self.fallback_provider
        ):
            self.fallback_provider = None

    def process(
        self,
        image_path: str | Path,
    ) -> OCRResult:

        image_path = Path(image_path)

        primary_error: Exception | None = None

        # ====================================================
        # PRIMARY — MISTRAL
        # ====================================================

        try:

            logger.info(
                "Starting primary OCR provider: %s",
                self.primary_provider,
            )

            engine = get_ocr_engine(
                self.primary_provider
            )

            result = engine.process(
                image_path
            )

            if result.success:

                result.fallback_used = False

                logger.info(
                    "Primary OCR succeeded: %s",
                    self.primary_provider,
                )

                return result

            primary_error = RuntimeError(
                "Primary OCR returned unsuccessful result."
            )

        except Exception as exc:

            primary_error = exc

            logger.warning(
                "Primary OCR failed (%s): %s",
                self.primary_provider,
                exc,
            )

        # ====================================================
        # FALLBACK — GEMINI
        # ====================================================

        if self.fallback_provider:

            try:

                logger.info(
                    "Trying fallback OCR provider: %s",
                    self.fallback_provider,
                )

                fallback_engine = get_ocr_engine(
                    self.fallback_provider
                )

                fallback_result = (
                    fallback_engine.process(
                        image_path
                    )
                )

                if fallback_result.success:

                    fallback_result.fallback_used = True

                    fallback_result.metadata[
                        "fallback_provider"
                    ] = self.fallback_provider

                    fallback_result.metadata[
                        "primary_provider"
                    ] = self.primary_provider

                    fallback_result.metadata[
                        "primary_error"
                    ] = str(primary_error)

                    logger.info(
                        "Fallback OCR succeeded: %s",
                        self.fallback_provider,
                    )

                    return fallback_result

                raise RuntimeError(
                    "Fallback OCR returned "
                    "unsuccessful result."
                )

            except Exception as fallback_error:

                logger.error(
                    "Fallback OCR failed (%s): %s",
                    self.fallback_provider,
                    fallback_error,
                )

                raise RuntimeError(
                    "All OCR providers failed. "
                    f"Primary ({self.primary_provider}): "
                    f"{primary_error}; "
                    f"Fallback ({self.fallback_provider}): "
                    f"{fallback_error}"
                ) from fallback_error

        # ====================================================
        # NO FALLBACK
        # ====================================================

        raise RuntimeError(
            f"Primary OCR provider "
            f"({self.primary_provider}) failed: "
            f"{primary_error}"
        )