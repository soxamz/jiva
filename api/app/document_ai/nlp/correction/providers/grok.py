from __future__ import annotations

import os

from pydantic import BaseModel, Field
from xai_sdk import Client
from xai_sdk.chat import system, user

from ..models import (
    CorrectionCandidate,
    CorrectionResult,
)


class CorrectionItem(BaseModel):
    raw_text: str
    corrected_text: str
    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )
    reason: str


class CorrectionResponse(BaseModel):
    corrected_text: str
    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )
    requires_review: bool
    corrections: list[
        CorrectionItem
    ]


class GrokCorrectionProvider:

    DEFAULT_MODEL = "grok-4.6"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model_name: str | None = None,
    ) -> None:

        key = (
            api_key
            or os.getenv("XAI_API_KEY")
        )

        self._model_name = (
            model_name
            or os.getenv(
                "GROK_MODEL",
                self.DEFAULT_MODEL,
            )
        )

        self._client: Client | None = None

        if key:
            self._client = Client(
                api_key=key
            )

    @property
    def available(self) -> bool:
        return self._client is not None

    @property
    def provider_name(self) -> str:
        return "grok"

    @property
    def model_name(self) -> str:
        return self._model_name

    def correct_text(
        self,
        raw_text: str,
    ) -> CorrectionResult | None:

        if not raw_text.strip():

            return CorrectionResult(
                raw_text=raw_text,
                corrected_text=raw_text,
                confidence=1.0,
                changed=False,
                requires_review=False,
                provider=self.provider_name,
                model=self.model_name,
            )

        if not self.available:
            return None

        try:

            chat = self._client.chat.create(
                model=self.model_name,
                temperature=0.0,
                response_format=(
                    CorrectionResponse
                ),
            )

            chat.append(
                system(
                    self._system_prompt()
                )
            )

            chat.append(
                user(
                    raw_text
                )
            )

            response = chat.sample()

            result = (
                CorrectionResponse.model_validate_json(
                    response.content
                )
            )

            corrections = [
                CorrectionCandidate(
                    raw_text=item.raw_text,
                    corrected_text=(
                        item.corrected_text
                    ),
                    confidence=item.confidence,
                    accepted=True,
                    reason=item.reason,
                )
                for item in result.corrections
            ]

            return CorrectionResult(
                raw_text=raw_text,
                corrected_text=(
                    result.corrected_text
                ),
                confidence=result.confidence,
                changed=(
                    result.corrected_text
                    != raw_text
                ),
                requires_review=(
                    result.requires_review
                ),
                corrections=corrections,
                provider=self.provider_name,
                model=self.model_name,
            )

        except Exception as exc:

            print(
                f"[Grok] API error: {exc}"
            )

            return None

    @staticmethod
    def _system_prompt() -> str:

        return """
You are a medical OCR correction engine.

Your ONLY task is to correct genuine OCR errors.

Do NOT:
- diagnose
- summarize
- interpret
- add information
- remove information
- rewrite valid text
- change names
- change dates
- change numbers
- change units
- change medication doses
- invent information

Preserve:
- line breaks
- paragraphs
- punctuation
- ordering
- capitalization
- numbers
- units
- dates
- names
- addresses
- abbreviations

Correct only obvious OCR corruption.

Examples:

Hypertenslon -> Hypertension
arthritls -> arthritis
d1abetes -> diabetes
pneumonla -> pneumonia

If uncertain, preserve the original text and set
requires_review=true.

The corrected_text must contain the COMPLETE OCR text.
"""