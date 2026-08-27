from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from api.app.document_ai.pipeline import DocumentAIPipeline


# ============================================================
# BASE DIRECTORY
# ============================================================

BASE_DIR = Path(__file__).resolve().parent


# ============================================================
# TEST IMAGE
# ============================================================
#
# Defaults to the bundled 33.jpg sample. Override with
# DOCUMENT_AI_TEST_IMAGE (absolute path, or a file name inside
# ocr/dataset) to run the same pipeline over another document.
# ============================================================

DEFAULT_IMAGE = (
    BASE_DIR
    / "ocr"
    / "dataset"
    / "38.jpg"
)

_image_override = os.getenv(
    "DOCUMENT_AI_TEST_IMAGE",
    "",
).strip()

if _image_override:

    _override_path = Path(
        _image_override
    )

    IMAGE_PATH = (
        _override_path
        if _override_path.is_absolute()
        else BASE_DIR
        / "ocr"
        / "dataset"
        / _override_path
    )

else:
    IMAGE_PATH = DEFAULT_IMAGE


# ============================================================
# OUTPUT
# ============================================================

OUTPUT_DIR = (
    BASE_DIR
    / "output"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

OUTPUT_PATH = (
    OUTPUT_DIR
    / f"{IMAGE_PATH.stem}_ml2.json"
)


# ============================================================
# PROVIDERS
# ============================================================

OCR_PROVIDER = os.getenv(
    "OCR_PROVIDER",
    "mistral",
)

CORRECTION_PROVIDER = os.getenv(
    "CORRECTION_PROVIDER",
    "groq",
)

EXTRACTION_PROVIDER = os.getenv(
    "EXTRACTION_PROVIDER",
    "mistral",
)


# ============================================================
# HELPERS
# ============================================================

def save_json(
    data: dict[str, Any],
    path: Path,
) -> None:

    with path.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False,
            default=str,
        )


def print_section(
    title: str,
) -> None:

    print()
    print("=" * 80)
    print(title)
    print("=" * 80)


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    print("=" * 80)
    print("JIVA — ML2 DOCUMENT AI PIPELINE")
    print("=" * 80)

    print(
        f"Image: {IMAGE_PATH}"
    )

    print(
        f"OCR provider: {OCR_PROVIDER}"
    )

    print(
        f"Correction provider: "
        f"{CORRECTION_PROVIDER}"
    )

    print(
        f"Extraction provider: "
        f"{EXTRACTION_PROVIDER}"
    )

    print()

    if not IMAGE_PATH.exists():

        raise FileNotFoundError(
            "Input image does not exist:\n"
            f"{IMAGE_PATH}"
        )

    print(
        "Running full ML2 pipeline..."
    )

    pipeline = DocumentAIPipeline(
        ocr_provider=OCR_PROVIDER,
        correction_provider=(
            CORRECTION_PROVIDER
        ),
        extraction_provider=(
            EXTRACTION_PROVIDER
        ),
    )

    result = pipeline.process(
        IMAGE_PATH
    )

    save_json(
        result,
        OUTPUT_PATH,
    )

    # ========================================================
    # SUMMARY
    # ========================================================

    print_section(
        "ML2 PIPELINE COMPLETE"
    )

    print(
        f"Document ID: "
        f"{result.get('document_id')}"
    )

    print(
        f"Document type: "
        f"{result.get('document_type')}"
    )

    source = result.get(
        "source",
        {},
    )

    confidence = result.get(
        "confidence",
        {},
    )

    print(
        f"OCR confidence: "
        f"{source.get('ocr_confidence')}"
    )

    print(
        f"Correction confidence: "
        f"{confidence.get('correction')}"
    )

    print(
        f"Extraction confidence: "
        f"{confidence.get('extraction')}"
    )

    print(
        f"Final confidence: "
        f"{confidence.get('final')}"
    )

    print(
        f"Manual review required: "
        f"{confidence.get('manual_review_required')}"
    )

    patient = result.get(
        "patient",
        {},
    )

    print()

    print(
        f"Patient: "
        f"{patient.get('name')}"
    )

    print(
        f"Age: "
        f"{patient.get('age')}"
    )

    print(
        f"Sex: "
        f"{patient.get('sex')}"
    )

    print()

    print(
        f"Clinical results: "
        f"{len(result.get('clinical_results', []))}"
    )

    print(
        f"Medications: "
        f"{len(result.get('medications', []))}"
    )

    print(
        f"Diagnoses: "
        f"{len(result.get('diagnoses', []))}"
    )

    print(
        f"Symptoms: "
        f"{len(result.get('symptoms', []))}"
    )

    print(
        f"Procedures: "
        f"{len(result.get('procedures', []))}"
    )

    # ========================================================
    # STRUCTURED OUTPUT
    # ========================================================

    terminal_result = dict(
        result
    )

    terminal_result.pop(
        "raw_ocr_text",
        None,
    )

    terminal_result.pop(
        "corrected_ocr_text",
        None,
    )

    print_section(
        "STRUCTURED ML2 JSON"
    )

    print(
        json.dumps(
            terminal_result,
            indent=2,
            ensure_ascii=False,
            default=str,
        )
    )

    # ========================================================
    # OUTPUT PATH
    # ========================================================

    print_section(
        "OUTPUT"
    )

    print(
        f"Saved to:\n{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()