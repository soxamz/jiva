from __future__ import annotations

import logging

from google import genai

from app.config import get_settings
from app.schemas.intake import PatientHistory, PhysicianSummary, SessionState
from app.services.llm import redact_pii

logger = logging.getLogger(__name__)


def draft_physician_summary(
    session: SessionState,
    history: PatientHistory,
    fallback: PhysicianSummary,
) -> PhysicianSummary:
    """Create a clinician-review draft from session-grounded facts only."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return fallback

    transcript = redact_pii(
        "\n".join(f"{turn.role}: {turn.content}" for turn in session.transcript[-12:])
    )
    prompt = (
        "Create a concise bilingual clinical handoff draft from the supplied facts. "
        "This is not a diagnosis and must not include treatment advice. Never add, infer, "
        "or negate a symptom, medication, allergy, duration, severity, examination finding, "
        "or diagnosis that is absent from the facts. "
        "Preserve point-wise structure with markdown: use newlines, '- ' bullets, and "
        "'**Label:**' bold markers for HPI fields and AYUSH/Dashavidha parameters "
        "(Associations, Time course, Vaya, Prakriti, Vikriti, Pramana, "
        "Ahara Shakti / Agni, Vyayama Shakti, Provisional notes, etc.). "
        "Do not flatten into a single paragraph. Do not invent pain at an unspecified "
        "site when the chief complaint is fever or another non-pain problem. "
        "Omit duplicate values repeated under multiple AYUSH labels. "
        "Return JSON only.\n\n"
        f"Patient history JSON:\n{history.model_dump_json()}\n\n"
        f"Validated draft fallback:\n{fallback.model_dump_json()}\n\n"
        f"Redacted transcript for wording context:\n{transcript}"
    )

    try:
        with genai.Client(
            api_key=settings.gemini_api_key,
            http_options={"timeout": settings.ai_timeout_ms},
        ) as client:
            response = client.models.generate_content(
                model=settings.gemini_llm_close,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": PhysicianSummary,
                    "automatic_function_calling": {"disable": True},
                },
            )
            candidate = PhysicianSummary.model_validate_json(response.text or "{}")
    except Exception:
        logger.exception("Gemini summary generation failed; using deterministic summary")
        return fallback

    # Keep system-controlled safeguards and emergency results authoritative.
    candidate.is_draft = True
    candidate.disclaimer = fallback.disclaimer
    candidate.red_flags = fallback.red_flags
    if not candidate.highlights:
        candidate.highlights = fallback.highlights
    # Prefer structured fallback when Gemini flattens the point-wise draft.
    fb = fallback.en or ""
    cand = candidate.en or ""
    if ("\n" not in cand or "**" not in cand) and ("\n" in fb and "**" in fb):
        candidate.en = fb
    fb_hi = fallback.hi or ""
    cand_hi = candidate.hi or ""
    if ("\n" not in cand_hi or "**" not in cand_hi) and ("\n" in fb_hi and "**" in fb_hi):
        candidate.hi = fb_hi
    logger.info("Gemini generated a clinician-review summary draft")
    return candidate
