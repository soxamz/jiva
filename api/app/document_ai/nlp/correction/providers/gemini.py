from __future__ import annotations

import json
import os
from typing import Any

from google import genai
from google.genai import types

from ..models import (
    CorrectionCandidate,
    CorrectionResult,
)


class GeminiCorrectionProvider:

    DEFAULT_MODEL = "gemini-3.6-flash"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model_name: str | None = None,
    ) -> None:

        key = (
            api_key
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
        )

        self._client: genai.Client | None = None

        self._model_name = (
            model_name
            or os.getenv(
                "GEMINI_MODEL",
                self.DEFAULT_MODEL,
            )
        )

        if key:
            self._client = genai.Client(
                api_key=key
            )

    @property
    def available(self) -> bool:
        return self._client is not None

    @property
    def provider_name(self) -> str:
        return "gemini"

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

            response = (
                self._client.models.generate_content(
                    model=self.model_name,
                    contents=self._prompt(
                        raw_text
                    ),
                    config=self._config(),
                )
            )

            data = self._parse(
                response
            )

            if data is None:
                return None

            corrections = []

            for item in data["corrections"]:

                corrections.append(
                    CorrectionCandidate(
                        raw_text=item["raw_text"],
                        corrected_text=(
                            item["corrected_text"]
                        ),
                        confidence=self._clamp(
                            item["confidence"]
                        ),
                        accepted=True,
                        reason=item["reason"],
                    )
                )

            corrected = data[
                "corrected_text"
            ]

            return CorrectionResult(
                raw_text=raw_text,
                corrected_text=corrected,
                confidence=self._clamp(
                    data["confidence"]
                ),
                changed=(
                    corrected != raw_text
                ),
                requires_review=bool(
                    data["requires_review"]
                ),
                corrections=corrections,
                provider=self.provider_name,
                model=self.model_name,
            )

        except Exception as exc:

            print(
                f"[Gemini] API error: {exc}"
            )

            return None

    @staticmethod
    def _config() -> types.GenerateContentConfig:

        return types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",

            response_schema={
                "type": "object",
                "properties": {
                    "corrected_text": {
                        "type": "string"
                    },
                    "confidence": {
                        "type": "number"
                    },
                    "requires_review": {
                        "type": "boolean"
                    },
                    "corrections": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "raw_text": {
                                    "type": "string"
                                },
                                "corrected_text": {
                                    "type": "string"
                                },
                                "confidence": {
                                    "type": "number"
                                },
                                "reason": {
                                    "type": "string"
                                },
                            },
                            "required": [
                                "raw_text",
                                "corrected_text",
                                "confidence",
                                "reason",
                            ],
                        },
                    },
                },
                "required": [
                    "corrected_text",
                    "confidence",
                    "requires_review",
                    "corrections",
                ],
            },

            automatic_function_calling=(
                types.AutomaticFunctionCallingConfig(
                    disable=True
                )
            ),
        )

    @staticmethod
    def _prompt(
        raw_text: str,
    ) -> str:

        return f"""
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

Correct obvious OCR errors such as:
- character substitutions
- missing characters
- extra characters
- merged characters
- split characters
- obvious medical spelling corruption

Examples:

Hypertenslon -> Hypertension
arthritls -> arthritis
d1abetes -> diabetes
pneumonla -> pneumonia

If uncertain, DO NOT change the text.
Set requires_review=true.

The corrected_text must contain the COMPLETE OCR text.

Return only JSON.

RAW OCR:

---BEGIN---
{raw_text}
---END---
"""

    @staticmethod
    def _parse(
        response: Any,
    ) -> dict[str, Any] | None:

        text = getattr(
            response,
            "text",
            None,
        )

        if not text:
            return None

        try:
            data = json.loads(text)
        except (
            TypeError,
            ValueError,
        ):
            return None

        if not isinstance(
            data,
            dict,
        ):
            return None

        corrected = data.get(
            "corrected_text"
        )

        if not isinstance(
            corrected,
            str,
        ):
            return None

        try:
            confidence = float(
                data.get(
                    "confidence",
                    0.0,
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            confidence = 0.0

        corrections = data.get(
            "corrections",
            [],
        )

        if not isinstance(
            corrections,
            list,
        ):
            corrections = []

        normalized = []

        for item in corrections:

            if not isinstance(
                item,
                dict,
            ):
                continue

            try:
                item_confidence = float(
                    item.get(
                        "confidence",
                        0.0,
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                item_confidence = 0.0

            normalized.append(
                {
                    "raw_text": str(
                        item.get(
                            "raw_text",
                            "",
                        )
                    ),
                    "corrected_text": str(
                        item.get(
                            "corrected_text",
                            "",
                        )
                    ),
                    "confidence": (
                        item_confidence
                    ),
                    "reason": str(
                        item.get(
                            "reason",
                            "",
                        )
                    ),
                }
            )

        return {
            "corrected_text": corrected,
            "confidence": confidence,
            "requires_review": bool(
                data.get(
                    "requires_review",
                    False,
                )
            ),
            "corrections": normalized,
        }

    @staticmethod
    def _clamp(
        value: float,
    ) -> float:

        return max(
            0.0,
            min(
                1.0,
                value,
            )
        )