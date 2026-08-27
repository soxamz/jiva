from __future__ import annotations


# Strong signals are checked first.
# These are much more reliable than generic words such as
# "clinical", "history", or "symptoms".

STRONG_DOCUMENT_SIGNALS = {
    "prescription": [
        "doctor prescription",
        "medicine prescribed",
        "medicines prescribed",
        "prescription",
        "rx",
        "medicine prescribed :",
        "prescription :",
        "inj ",
        "tab ",
        "capsule",
        "capsules",
        "dosage",
        "dose",
    ],

    "diagnostic_report": [
        "diagnostic report",
        "laboratory report",
        "lab report",
        "test report",
        "investigation report",
        "pathology report",
        "radiology report",
        "impression",
        "reference range",
        "reference ranges",
        "findings",
        "patient results",
    ],

    "follow_up_note": [
        "follow up note",
        "follow-up note",
        "follow up date",
        "follow-up date",
        "return to clinic",
        "rtc",
    ],

    "clinical_note": [
        "clinical note",
        "clinical examination",
        "assessment",
        "plan",
        "history / symptoms",
        "history:",
        "symptoms:",
    ],
}


# Generic signals are used only after strong signals.
DOCUMENT_KEYWORDS = {
    "prescription": [
        "tablet",
        "tab.",
        "capsule",
        "cap.",
        "mg",
        "dose",
        "dosage",
        "medicine",
        "medication",
        "injection",
    ],

    "clinical_note": [
        "o/e",
        "assessment",
        "plan",
        "history",
        "clinical",
        "symptoms",
        "examination",
    ],

    "diagnostic_report": [
        "report",
        "impression",
        "findings",
        "scan",
        "mri",
        "ct",
        "ultrasound",
        "x-ray",
        "result",
        "reference range",
    ],

    "follow_up_note": [
        "follow up",
        "follow-up",
        "rtc",
        "return to clinic",
    ],
}


def classify_document(
    text: str,
) -> str:
    """
    Classify a medical document.

    Priority:
        1. Strong document-specific signals
        2. Generic keyword scoring
        3. medical_document fallback

    Strong prescription signals intentionally override generic
    clinical-note terms such as "clinical", "history", etc.
    """

    if not text:
        return "medical_document"

    normalized = " ".join(
        text.lower().split()
    )

    # ========================================================
    # 1. Strong signal detection
    # ========================================================

    strong_scores: dict[str, int] = {}

    for document_type, keywords in (
        STRONG_DOCUMENT_SIGNALS.items()
    ):

        score = 0

        for keyword in keywords:

            if keyword in normalized:
                score += 1

        strong_scores[
            document_type
        ] = score

    strongest_type = max(
        strong_scores,
        key=strong_scores.get,
    )

    strongest_score = strong_scores[
        strongest_type
    ]

    # Any strong prescription signal should classify
    # prescription before generic clinical-note signals.
    if strongest_score > 0:
        return strongest_type

    # ========================================================
    # 2. Generic keyword scoring
    # ========================================================

    scores: dict[str, int] = {}

    for document_type, keywords in (
        DOCUMENT_KEYWORDS.items()
    ):

        scores[document_type] = sum(
            1
            for keyword in keywords
            if keyword in normalized
        )

    if not scores:
        return "medical_document"

    best_type = max(
        scores,
        key=scores.get,
    )

    if scores[best_type] == 0:
        return "medical_document"

    return best_type