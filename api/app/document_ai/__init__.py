"""Document AI package.

Heavy OCR/ML imports are loaded lazily by pipeline modules so the FastAPI
app can boot without the full Document AI dependency set installed.
"""

from .ocr import OCRRouter

from .extraction import (
    ExtractionEngine,
    MistralExtractionEngine,
    get_extraction_engine,
    ABDMExtractionResult,
    ClinicalData,
    ClinicalItem,
    ClinicalResult,
    Encounter,
    ExtractionMetadata,
    Medication,
    Patient,
    ReportInfo,
    Uncertainty,
)

__all__ = [
    "OCRRouter",
    "ExtractionEngine",
    "MistralExtractionEngine",
    "get_extraction_engine",
    "ABDMExtractionResult",
    "ClinicalData",
    "ClinicalItem",
    "ClinicalResult",
    "Encounter",
    "ExtractionMetadata",
    "Medication",
    "Patient",
    "ReportInfo",
    "Uncertainty",
]
