from __future__ import annotations

from .correction import MedicalOCRCorrectionEngine
from .correction.models import CorrectionResult


class MedicalNLP:
    def __init__(self, *, correction_engine: MedicalOCRCorrectionEngine | None = None) -> None:
        self.correction_engine = correction_engine or MedicalOCRCorrectionEngine()

    def process(self, text: str) -> CorrectionResult:
        return self.correction_engine.process(text)
