from __future__ import annotations

from pydantic import BaseModel, Field


class NormalizedConcept(BaseModel):
    """
    Canonical terminology result.

    original_text:
        Text produced by OCR/NLP.

    preferred_name:
        Canonical name returned by the terminology source.

    cui:
        MedGen concept identifier when available.

    source:
        Terminology/source vocabulary.

    confidence:
        Confidence in the normalization match.

    matched:
        Whether a terminology match was found.

    requires_review:
        Whether the result should be reviewed before
        being used for clinical downstream processing.
    """

    original_text: str

    preferred_name: str | None = None

    cui: str | None = None

    source: str | None = None

    synonyms: list[str] = Field(
        default_factory=list
    )

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )

    matched: bool = False

    exact_match: bool = False

    requires_review: bool = True


class NormalizationResult(BaseModel):
    concepts: list[NormalizedConcept] = Field(
        default_factory=list
    )

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )

    requires_manual_review: bool = True