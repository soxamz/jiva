from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any



@dataclass
class ConfidenceResult:
    ocr_score: float
    extraction_score: float
    grounding_score: float
    validation_score: float
    final_score: float
    manual_review_required: bool

    def model_dump(self) -> dict:
        return {
            "ocr_score": self.ocr_score,
            "extraction_score": self.extraction_score,
            "grounding_score": self.grounding_score,
            "validation_score": self.validation_score,
            "final_score": self.final_score,
            "manual_review_required": (
                self.manual_review_required
            ),
        }


class ConfidenceEngine:

    def __init__(self) -> None:

        self.ocr_weight = float(
            os.getenv(
                "CONFIDENCE_WEIGHT_OCR",
                "0.3",
            )
        )

        self.extraction_weight = float(
            os.getenv(
                "CONFIDENCE_WEIGHT_EXTRACTION",
                "0.4",
            )
        )

        self.grounding_weight = float(
            os.getenv(
                "CONFIDENCE_WEIGHT_GROUNDING",
                "0.3",
            )
        )

        self.manual_review_threshold = float(
            os.getenv(
                "MANUAL_REVIEW_THRESHOLD",
                "0.70",
            )
        )

        self._validate_weights()

    def calculate(
        self,
        ocr_score: float,
        extraction_score: float,
        grounding_score: float,
        validation_score: float = 1.0,
    ) -> ConfidenceResult:

        ocr_score = self._clamp(
            ocr_score
        )

        extraction_score = self._clamp(
            extraction_score
        )

        grounding_score = self._clamp(
            grounding_score
        )

        validation_score = self._clamp(
            validation_score
        )

        # Primary configured weighting.
        base_score = (
            (
                ocr_score
                * self.ocr_weight
            )
            + (
                extraction_score
                * self.extraction_weight
            )
            + (
                grounding_score
                * self.grounding_weight
            )
        )

        # Validation acts as a safety multiplier.
        final_score = (
            base_score
            * validation_score
        )

        final_score = round(
            self._clamp(
                final_score
            ),
            4,
        )

        manual_review = (
            final_score
            < self.manual_review_threshold
        )

        return ConfidenceResult(
            ocr_score=ocr_score,
            extraction_score=extraction_score,
            grounding_score=grounding_score,
            validation_score=validation_score,
            final_score=final_score,
            manual_review_required=manual_review,
        )

    @staticmethod
    def _clamp(
        value: float,
    ) -> float:

        return max(
            0.0,
            min(
                1.0,
                float(value),
            ),
        )

    def _validate_weights(
        self,
    ) -> None:

        total = (
            self.ocr_weight
            + self.extraction_weight
            + self.grounding_weight
        )

        if abs(
            total - 1.0
        ) > 0.001:

            raise ValueError(
                "Confidence weights must sum to 1.0. "
                f"Current sum: {total}"
            )


def calculate_confidence(
    ocr_confidence: float | None,
    extraction: Any,
    grounding: Any | None,
    validation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Helper function to calculate confidence based on OCR confidence,
    extraction result, grounding result, and validation result.
    """
    ext_score = 0.0
    if extraction and hasattr(extraction, "metadata") and extraction.metadata:
        ext_score = extraction.metadata.extraction_confidence
    elif isinstance(extraction, dict):
        metadata = extraction.get("metadata", {})
        ext_score = metadata.get("extraction_confidence", 0.0) if metadata else 0.0
    if ext_score is None:
        ext_score = 0.0

    ocr_score = ocr_confidence if ocr_confidence is not None else 1.0

    grounding_score = 1.0
    if grounding is not None:
        if hasattr(grounding, "score"):
            grounding_score = grounding.score
        elif isinstance(grounding, dict):
            grounding_score = grounding.get("score", 1.0)
    if grounding_score is None:
        grounding_score = 1.0

    val_score = 1.0
    if validation:
        if isinstance(validation, dict):
            val_score = float(validation.get("score", 1.0))
        elif hasattr(validation, "score"):
            val_score = float(getattr(validation, "score"))

    engine = ConfidenceEngine()
    result = engine.calculate(
        ocr_score=ocr_score,
        extraction_score=ext_score,
        grounding_score=grounding_score,
        validation_score=val_score,
    )
    
    return {
        "confidence": result.final_score,
        "requires_manual_review": result.manual_review_required,
        "ocr_score": result.ocr_score,
        "extraction_score": result.extraction_score,
        "grounding_score": result.grounding_score,
        "validation_score": result.validation_score,
    }