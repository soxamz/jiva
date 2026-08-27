from __future__ import annotations

import base64
import os
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from mistralai.client import Mistral

from .base import OCREngine, OCRResult


# ============================================================
# Environment
# ============================================================

# Project root:
# Prefer api/.env (uvicorn cwd-independent), then repo .env.local
_API_DIR = Path(__file__).resolve().parents[3]  # .../api/app/document_ai/ocr -> api
_PROJECT_DIR = _API_DIR.parent
for _env_path in (_API_DIR / ".env", _PROJECT_DIR / ".env.local", Path.cwd() / ".env"):
    if _env_path.is_file():
        load_dotenv(_env_path, override=False)


class MistralOCREngine(OCREngine):
    """
    Production OCR engine using Mistral OCR.

    Primary provider:
        mistral-ocr-latest
    """

    provider = "mistral"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:

        self.api_key = (
            api_key
            or os.getenv("MISTRAL_API_KEY")
        )

        if not self.api_key:
            raise RuntimeError(
                "MISTRAL_API_KEY is not configured."
            )

        self.model = (
            model
            or os.getenv(
                "MISTRAL_OCR_MODEL",
                "mistral-ocr-latest",
            )
        )

        self.client = Mistral(
            api_key=self.api_key
        )

    # ========================================================
    # Public API
    # ========================================================

    def process(
        self,
        image_path: str | Path,
    ) -> OCRResult:

        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError(
                f"Image not found: {image_path}"
            )

        if not image_path.is_file():
            raise ValueError(
                f"Path is not a file: {image_path}"
            )

        document_payload = self._build_document_payload(
            image_path
        )

        start_time = time.perf_counter()

        try:

            response = self.client.ocr.process(
                model=self.model,
                document=document_payload,
                include_image_base64=False,
                include_blocks=True,
                confidence_scores_granularity="block",
            )

        except Exception as exc:

            elapsed_ms = (
                time.perf_counter()
                - start_time
            ) * 1000

            raise RuntimeError(
                "Mistral OCR failed "
                f"after {elapsed_ms:.2f} ms: "
                f"{exc}"
            ) from exc

        elapsed_ms = (
            time.perf_counter()
            - start_time
        ) * 1000

        return self._build_result(
            response=response,
            image_path=image_path,
            elapsed_ms=elapsed_ms,
        )

    def _build_document_payload(
        self,
        path: Path,
    ) -> dict[str, str]:
        """Build Mistral OCR document payload for images or PDFs."""

        suffix = path.suffix.lower()
        encoded = self._encode_image(path)

        if suffix == ".pdf":
            return {
                "type": "document_url",
                "document_url": (
                    f"data:application/pdf;base64,{encoded}"
                ),
            }

        mime_type = self._get_mime_type(path)
        return {
            "type": "image_url",
            "image_url": (
                f"data:{mime_type};base64,{encoded}"
            ),
        }

    # ========================================================
    # Response normalization
    # ========================================================

    def _build_result(
        self,
        response: Any,
        image_path: Path,
        elapsed_ms: float,
    ) -> OCRResult:

        pages = getattr(
            response,
            "pages",
            None,
        ) or []

        markdown_parts: list[str] = []
        normalized_blocks: list[dict[str, Any]] = []

        for page_index, page in enumerate(
            pages
        ):

            # ------------------------------------------------
            # Markdown
            # ------------------------------------------------

            markdown = getattr(
                page,
                "markdown",
                None,
            )

            if markdown:
                markdown_parts.append(
                    str(markdown)
                )

            # ------------------------------------------------
            # Blocks
            # ------------------------------------------------

            page_blocks = getattr(
                page,
                "blocks",
                None,
            ) or []

            for block_index, block in enumerate(
                page_blocks
            ):

                normalized_blocks.append(
                    self._normalize_block(
                        block=block,
                        page_index=page_index,
                        block_index=block_index,
                    )
                )

        text = "\n\n".join(
            markdown_parts
        ).strip()

        document_confidence = (
            self._calculate_document_confidence(
                normalized_blocks
            )
        )

        return OCRResult(
            text=text,
            provider=self.provider,
            model=self.model,
            confidence=document_confidence,
            processing_time_ms=elapsed_ms,
            markdown=text,
            blocks=normalized_blocks,
            success=True,
            fallback_used=False,
            metadata={
                "provider": self.provider,
                "model": self.model,
                "image_path": str(image_path),
                "page_count": len(pages),
                "block_count": len(
                    normalized_blocks
                ),
            },
        )

    # ========================================================
    # Block normalization
    # ========================================================

    @classmethod
    def _normalize_block(
        cls,
        block: Any,
        page_index: int,
        block_index: int,
    ) -> dict[str, Any]:

        content = getattr(
            block,
            "content",
            None,
        )

        label = getattr(
            block,
            "label",
            None,
        )

        bbox = getattr(
            block,
            "bbox",
            None,
        )

        confidence = getattr(
            block,
            "confidence_scores",
            None,
        )

        bbox = cls._to_serializable(
            bbox
        )

        raw_confidence = cls._to_serializable(
            confidence
        )

        normalized_confidence = (
            cls._normalize_confidence(
                confidence
            )
        )

        return {
            "page": page_index,
            "index": block_index,
            "label": label,
            "content": content,
            "bbox": bbox,
            "confidence": normalized_confidence,
            "raw_confidence": raw_confidence,
        }

    # ========================================================
    # Confidence normalization
    # ========================================================

    @classmethod
    def _normalize_confidence(
        cls,
        confidence: Any,
    ) -> dict[str, float | None]:

        if confidence is None:
            return {
                "average_content": None,
                "minimum_content": None,
                "block_type": None,
            }

        confidence = cls._to_serializable(
            confidence
        )

        if not isinstance(
            confidence,
            dict,
        ):
            return {
                "average_content": None,
                "minimum_content": None,
                "block_type": None,
            }

        return {
            "average_content": cls._to_float(
                confidence.get(
                    "average_content_confidence_score"
                )
            ),
            "minimum_content": cls._to_float(
                confidence.get(
                    "minimum_content_confidence_score"
                )
            ),
            "block_type": cls._to_float(
                confidence.get(
                    "block_type_confidence_score"
                )
            ),
        }

    @classmethod
    def _calculate_document_confidence(
        cls,
        blocks: list[dict[str, Any]],
    ) -> float | None:

        scores: list[float] = []

        for block in blocks:

            confidence = block.get(
                "confidence"
            )

            if not isinstance(
                confidence,
                dict,
            ):
                continue

            score = confidence.get(
                "average_content"
            )

            if score is not None:
                scores.append(score)

        if not scores:
            return None

        return sum(scores) / len(scores)

    # ========================================================
    # Utilities
    # ========================================================

    @staticmethod
    def _encode_image(
        image_path: Path,
    ) -> str:

        with image_path.open("rb") as image_file:

            return base64.b64encode(
                image_file.read()
            ).decode("utf-8")

    @staticmethod
    def _get_mime_type(
        image_path: Path,
    ) -> str:

        mime_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".heic": "image/heic",
            ".heif": "image/heif",
        }

        mime_type = mime_types.get(
            image_path.suffix.lower()
        )

        if mime_type is None:
            raise ValueError(
                "Unsupported image format: "
                f"{image_path.suffix}"
            )

        return mime_type

    @staticmethod
    def _to_float(
        value: Any,
    ) -> float | None:

        if value is None:
            return None

        try:
            return float(value)

        except (
            TypeError,
            ValueError,
        ):
            return None

    @staticmethod
    def _to_serializable(
        value: Any,
    ) -> Any:

        if value is None:
            return None

        # Pydantic models
        if hasattr(
            value,
            "model_dump",
        ):
            return value.model_dump()

        # Objects exposing dict()
        if hasattr(
            value,
            "dict",
        ):
            try:
                return value.dict()
            except Exception:
                pass

        # Lists / tuples
        if isinstance(
            value,
            (list, tuple),
        ):
            return [
                MistralOCREngine._to_serializable(
                    item
                )
                for item in value
            ]

        # Dictionaries
        if isinstance(
            value,
            dict,
        ):
            return {
                key: MistralOCREngine._to_serializable(
                    item
                )
                for key, item in value.items()
            }

        # Primitive values
        if isinstance(
            value,
            (str, int, float, bool),
        ):
            return value

        return str(value)