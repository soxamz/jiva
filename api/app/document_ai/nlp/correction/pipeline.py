from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from ...ocr.mistral_ocr_engine import (
    MistralOCREngine,
)

from .engine import (
    MedicalOCRCorrectionEngine,
)

class OCRCorrectionPipeline:

    def __init__(
        self,
        *,
        ocr_engine: Any | None = None,
        correction_engine: (
            MedicalOCRCorrectionEngine
            | None
        ) = None,
    ) -> None:

        load_dotenv(
            override=True
        )

        self.ocr = (
            ocr_engine
            or MistralOCREngine()
        )

        self.correction = (
            correction_engine
            or MedicalOCRCorrectionEngine()
        )

    def process(
        self,
        image_path: str | Path,
    ) -> dict[str, Any]:

        image_path = Path(
            image_path
        )

        # --------------------------------------------------
        # STEP 1 — OCR
        # --------------------------------------------------

        ocr_result = self.ocr.process(
            image_path
        )

        raw_text = (
            getattr(
                ocr_result,
                "text",
                "",
            )
            or ""
        )

        # --------------------------------------------------
        # STEP 2 — CORRECTION
        # --------------------------------------------------

        correction = (
            self.correction.correct(
                raw_text
            )
        )

        # --------------------------------------------------
        # FINAL JSON
        # --------------------------------------------------

        return {
            "document_id": image_path.stem,

            "source": {
                "image": str(
                    image_path
                ),
                "provider": getattr(
                    ocr_result,
                    "provider",
                    None,
                ),
                "model": getattr(
                    ocr_result,
                    "model",
                    None,
                ),
                "ocr_confidence": getattr(
                    ocr_result,
                    "confidence",
                    None,
                ),
                "page_count": (
                    getattr(
                        ocr_result,
                        "metadata",
                        {},
                    ).get(
                        "page_count"
                    )
                    if getattr(
                        ocr_result,
                        "metadata",
                        None,
                    )
                    else None
                ),
                "block_count": (
                    getattr(
                        ocr_result,
                        "metadata",
                        {},
                    ).get(
                        "block_count"
                    )
                    if getattr(
                        ocr_result,
                        "metadata",
                        None,
                    )
                    else None
                ),
            },

            "raw_ocr_text": raw_text,

            "correction": {
                "provider": (
                    correction.provider
                ),
                "model": (
                    correction.model
                ),
                "corrected_text": (
                    correction.corrected_text
                ),
                "confidence": (
                    correction.confidence
                ),
                "changed": (
                    correction.changed
                ),
                "requires_review": (
                    correction.requires_review
                ),
                "corrections": [
                    {
                        "raw_text": c.raw_text,
                        "corrected_text": (
                            c.corrected_text
                        ),
                        "confidence": (
                            c.confidence
                        ),
                        "accepted": (
                            c.accepted
                        ),
                        "reason": c.reason,
                    }
                    for c in (
                        correction.corrections
                    )
                ],
                "error": correction.error,
            },
        }

    def process_to_file(
        self,
        image_path: str | Path,
        output_path: str | Path,
    ) -> dict[str, Any]:

        result = self.process(
            image_path
        )

        output_path = Path(
            output_path
        )

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        output_path.write_text(
            json.dumps(
                result,
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        return result