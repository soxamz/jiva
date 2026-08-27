from __future__ import annotations

from typing import Protocol

from ..models import CorrectionResult


class CorrectionProvider(Protocol):

    @property
    def available(self) -> bool:
        ...

    @property
    def provider_name(self) -> str:
        ...

    @property
    def model_name(self) -> str:
        ...

    def correct_text(
        self,
        raw_text: str,
    ) -> CorrectionResult | None:
        ...