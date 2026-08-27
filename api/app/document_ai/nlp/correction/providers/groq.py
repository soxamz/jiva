from __future__ import annotations

import json
import os
from typing import Any

from groq import Groq

from ..models import (
    CorrectionCandidate,
    CorrectionResult,
)


class GroqCorrectionProvider:
    """
    Groq-backed medical OCR correction provider.

    ONLY performs OCR correction.
    It must not perform medical proofreading,
    grammar correction, fact checking, or rewriting.
    """

    DEFAULT_MODEL = "openai/gpt-oss-120b"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model_name: str | None = None,
    ) -> None:

        key = (
            api_key
            or os.getenv("GROQ_API_KEY")
        )

        self._model_name = (
            model_name
            or os.getenv(
                "GROQ_MODEL",
                self.DEFAULT_MODEL,
            )
        )

        self._client: Groq | None = None

        if key:
            self._client = Groq(
                api_key=key
            )

    @property
    def available(self) -> bool:
        return self._client is not None

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def model_name(self) -> str:
        return self._model_name

    def correct_text(
        self,
        raw_text: str,
    ) -> CorrectionResult | None:

        raw_text = raw_text or ""

        if not raw_text.strip():
            return CorrectionResult(
                raw_text=raw_text,
                corrected_text=raw_text,
                confidence=1.0,
                changed=False,
                requires_review=False,
                corrections=[],
                provider=self.provider_name,
                model=self.model_name,
            )

        if not self.available:
            return None

        try:
            response = (
                self._client.chat.completions.create(
                    model=self.model_name,
                    temperature=0,
                    reasoning_effort="low",
                    max_completion_tokens=4096,
                    messages=[
                        {
                            "role": "system",
                            "content": self._system_prompt(),
                        },
                        {
                            "role": "user",
                            "content": (
                                "---BEGIN OCR---\n"
                                + raw_text
                                + "\n---END OCR---"
                            ),
                        },
                    ],
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "medical_ocr_correction",
                            "strict": True,
                            "schema": self._schema(),
                        },
                    },
                )
            )

            content = (
                response
                .choices[0]
                .message
                .content
            )

            if not content:
                print("[Groq] Empty response")
                return None

            data = json.loads(content)

            if not isinstance(data, dict):
                print("[Groq] Invalid JSON object")
                return None

            return self._build_result(
                raw_text,
                data,
            )

        except json.JSONDecodeError as exc:
            print(
                f"[Groq] JSON parse error: {exc}"
            )
            return None

        except Exception as exc:
            print(
                f"[Groq] API error: {exc}"
            )
            return None

    @staticmethod
    def _system_prompt() -> str:

        return """
You are a STRICT MEDICAL OCR ERROR CORRECTION ENGINE.

Your ONLY job is to repair obvious transcription errors
introduced by OCR.

You are NOT:
- a medical proofreader
- a grammar corrector
- a medical fact checker
- a clinical reasoning system
- a document rewriter

============================================================
ALLOWED CORRECTIONS
============================================================

Only correct errors that are strongly identifiable as
OCR character/transcription errors.

Examples:

Hypertenslon -> Hypertension
arthritls -> arthritis
d1abetes -> diabetes
pneumonla -> pneumonia
ZING -> ZINC

Typical allowed errors:

- wrong character
- missing character
- duplicated character
- extra character
- character substitution
- obvious character segmentation error
- obvious OCR spelling corruption

============================================================
STRICTLY FORBIDDEN
============================================================

DO NOT:

- improve grammar
- improve sentence structure
- rewrite wording
- correct singular/plural grammar
- improve punctuation for readability
- normalize capitalization
- expand abbreviations
- shorten abbreviations
- correct medical facts
- correct hospital names using outside knowledge
- correct doctor names using outside knowledge
- correct addresses using outside knowledge
- infer missing words
- infer missing phrases
- interpret unclear text
- change medication names unless the OCR corruption is
  clearly identifiable
- change medication doses
- change numbers
- change units
- change dates
- change times
- change phone numbers
- change email addresses
- change laboratory values

============================================================
IMPORTANT EXAMPLES
============================================================

GOOD:

"Hypertenslon"
→
"Hypertension"

"arthritls"
→
"arthritis"

"ZING 50 mg"
→
"ZINC 50 mg"

BAD:

"ICMR guideline"
→
"ICMR guidelines"

DO NOT make this change.

BAD:

"COVID the cases"
→
"COVID cases"

DO NOT make this change.

BAD:

"Sir Ganga Ram Kolmet Hospital"
→
"Sir Ganga Ram Hospital"

DO NOT make this change unless the OCR character
corruption itself is unambiguous.

BAD:

"5poom"
→
"Spoon"

or

"5 p.o.m."

DO NOT guess.

Preserve "5poom" and flag it for review.

============================================================
UNCERTAINTY RULE
============================================================

When there is ANY reasonable uncertainty:

1. Preserve the original text.
2. Do not guess.
3. Add the issue to corrections only if useful.
4. Set requires_review=true.

It is MUCH safer to leave an OCR error unchanged than
to introduce a new medical or factual error.

============================================================
DOCUMENT PRESERVATION
============================================================

The corrected_text MUST contain the COMPLETE original
document.

Preserve:

- line breaks
- paragraphs
- ordering
- punctuation
- numbers
- units
- dates
- names
- addresses
- phone numbers
- email addresses
- medication doses
- abbreviations

Only replace text when it is an obvious OCR error.

Do not summarize.

Do not omit text.

Do not add text.

============================================================
CONFIDENCE
============================================================

Confidence refers ONLY to confidence that the change is
an OCR correction.

It does NOT represent:
- medical confidence
- diagnostic confidence
- factual confidence
- clinical confidence

============================================================

Return ONLY the requested JSON structure.
"""

    @staticmethod
    def _schema() -> dict[str, Any]:

        return {
            "type": "object",
            "additionalProperties": False,

            "properties": {
                "corrected_text": {
                    "type": "string",
                },

                "confidence": {
                    "type": "number",
                },

                "requires_review": {
                    "type": "boolean",
                },

                "corrections": {
                    "type": "array",

                    "items": {
                        "type": "object",
                        "additionalProperties": False,

                        "properties": {
                            "raw_text": {
                                "type": "string",
                            },

                            "corrected_text": {
                                "type": "string",
                            },

                            "confidence": {
                                "type": "number",
                            },

                            "reason": {
                                "type": "string",
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
        }

    def _build_result(
        self,
        raw_text: str,
        data: dict[str, Any],
    ) -> CorrectionResult:

        corrected_text = str(
            data.get(
                "corrected_text",
                raw_text,
            )
        )

        confidence = self._clamp(
            data.get(
                "confidence",
                0.0,
            )
        )

        requires_review = bool(
            data.get(
                "requires_review",
                False,
            )
        )

        corrections: list[
            CorrectionCandidate
        ] = []

        raw_corrections = data.get(
            "corrections",
            [],
        )

        if not isinstance(
            raw_corrections,
            list,
        ):
            raw_corrections = []

        for item in raw_corrections:

            if not isinstance(
                item,
                dict,
            ):
                continue

            raw = str(
                item.get(
                    "raw_text",
                    "",
                )
            )

            corrected = str(
                item.get(
                    "corrected_text",
                    "",
                )
            )

            # Never accept a correction that does not
            # actually change the text.
            accepted = (
                raw != corrected
            )

            corrections.append(
                CorrectionCandidate(
                    raw_text=raw,
                    corrected_text=corrected,
                    confidence=self._clamp(
                        item.get(
                            "confidence",
                            0.0,
                        )
                    ),
                    accepted=accepted,
                    reason=str(
                        item.get(
                            "reason",
                            "",
                        )
                    ),
                )
            )

        return CorrectionResult(
            raw_text=raw_text,
            corrected_text=corrected_text,
            confidence=confidence,
            changed=(
                corrected_text != raw_text
            ),
            requires_review=requires_review,
            corrections=corrections,
            provider=self.provider_name,
            model=self.model_name,
        )

    @staticmethod
    def _clamp(
        value: Any,
    ) -> float:

        try:
            value = float(value)
        except (
            TypeError,
            ValueError,
        ):
            return 0.0

        return max(
            0.0,
            min(
                1.0,
                value,
            )
        )