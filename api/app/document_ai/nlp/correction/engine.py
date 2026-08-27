from __future__ import annotations

from .models import (
    CorrectionCandidate,
    CorrectionResult,
)
from .providers import (
    get_correction_provider,
)
from .providers.base import (
    CorrectionProvider,
)


class MedicalOCRCorrectionEngine:
    """
    Provider-independent medical OCR correction engine.

    Provider selection:

        OCR_CORRECTION_PROVIDER=gemini

    or:

        OCR_CORRECTION_PROVIDER=grok
    """

    def __init__(
        self,
        *,
        provider: CorrectionProvider | None = None,
        **_: object,
    ) -> None:

        self.provider = (
            provider
            or get_correction_provider()
        )

    @property
    def available(self) -> bool:
        return self.provider.available

    @property
    def provider_name(self) -> str:
        return self.provider.provider_name

    @property
    def model_name(self) -> str:
        return self.provider.model_name

    def correct(
        self,
        raw_text: str,
    ) -> CorrectionResult:

        raw_text = raw_text or ""

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

            return CorrectionResult(
                raw_text=raw_text,
                corrected_text=raw_text,
                confidence=0.0,
                changed=False,
                requires_review=True,
                provider=self.provider_name,
                model=self.model_name,
                error="Correction provider unavailable",
            )

        result = self.provider.correct_text(
            raw_text
        )

        if result is None:

            return CorrectionResult(
                raw_text=raw_text,
                corrected_text=raw_text,
                confidence=0.0,
                changed=False,
                requires_review=True,
                provider=self.provider_name,
                model=self.model_name,
                error="Correction provider failed",
            )

        return result

    process = correct