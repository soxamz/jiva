from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv

from app.schemas.clinical_summary import PhysicianDraftSummary

load_dotenv()

_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


def _context_from_payload(payload: dict[str, Any]) -> str:
    return json.dumps(payload, indent=2, default=str, ensure_ascii=False)


def _is_rate_limit_error(exc: BaseException) -> bool:
    msg = str(exc)
    return "429" in msg or "quota" in msg.lower() or "RateLimit" in type(exc).__name__


def _ml3_model_chain() -> list[str]:
    primary = os.getenv("ML3_LLM_MODEL", "openai/gemini-3.6-flash")
    fallback = os.getenv("ML3_LLM_MODEL_FALLBACK", "openai/gemini-3.5-flash-lite")
    if fallback and fallback != primary:
        return [primary, fallback]
    return [primary]


def _run_synthesis_for_model(context_text: str, model: str) -> dict[str, Any]:
    # Lazy import so the API can boot without CrewAI installed.
    from crewai import Agent, Crew, LLM, Process, Task

    gemini_llm = LLM(
        model=model,
        base_url=_GEMINI_BASE_URL,
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.0,
    )

    auditor = Agent(
        role="Clinical Contradiction Auditor",
        goal="Identify contradictions, red flag omissions, or discrepancies in patient intake data.",
        backstory=(
            "You are a clinical data auditor. You output findings directly and "
            "concisely in a single pass without unnecessary deliberation."
        ),
        llm=gemini_llm,
        verbose=False,
        max_iter=1,
        max_retry_limit=1,
        allow_delegation=False,
    )

    synthesizer = Agent(
        role="Physician Summary Synthesizer",
        goal="Translate regional terms to clinical English and structure data into PhysicianDraftSummary.",
        backstory=(
            "You are an expert bilingual medical scribe. You immediately map findings "
            "to standard allopathic terminology and generate structured clinical outputs."
        ),
        llm=gemini_llm,
        verbose=False,
        max_iter=1,
        max_retry_limit=1,
        allow_delegation=False,
    )

    audit_task = Task(
        description=(
            f"Analyze this clinical intake payload:\n{context_text}\n\n"
            "List any contradictions between symptoms, history, medications, allergies, "
            "OCR/lab reports, and red flags. If none, state 'No contradictions found.'"
        ),
        expected_output="A concise list of identified clinical contradictions.",
        agent=auditor,
    )

    synthesis_task = Task(
        description=(
            "Using the clinical payload and audit results:\n"
            "1. Translate colloquial terms/Hinglish (e.g., 'aaj' -> 'today', "
            "'boht painful' -> 'severe pain') to medical English.\n"
            "2. Populate SOCRATES history and extract medications.\n"
            "3. You MUST copy all items from the input medications list into the "
            "extracted_medications array. Do not omit any drugs.\n"
            "4. Generate 'doctor_english_summary' in MARKDOWN with sections:\n"
            "   **Chief Complaint:**\n"
            "   **Presentation:**\n"
            "   **System Warnings:**\n"
            "   **Action Required:**\n"
            "5. Generate 'patient_audio_confirmation' in conversational Hindi/Hinglish.\n"
            "6. Populate detected_contradictions and abnormal_lab_flags when applicable."
        ),
        expected_output=(
            "JSON strictly adhering to the PhysicianDraftSummary schema, "
            "with doctor_english_summary formatted in Markdown."
        ),
        agent=synthesizer,
        output_pydantic=PhysicianDraftSummary,
        context=[audit_task],
    )

    crew = Crew(
        agents=[auditor, synthesizer],
        tasks=[audit_task, synthesis_task],
        process=Process.sequential,
        memory=False,
        cache=False,
        verbose=False,
    )

    result = crew.kickoff()

    if getattr(result, "pydantic", None) is not None:
        return result.pydantic.model_dump()

    raw = getattr(result, "raw", result)
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"doctor_english_summary": raw, "raw": raw}
    return {"raw": str(raw)}


def run_synthesis_crew(
    clinical_context: str | dict[str, Any] | None = None,
    *,
    voice_transcript: str | None = None,
    ocr_data: str | dict[str, Any] | None = None,
    **payload: Any,
) -> dict[str, Any]:
    """Run ML3 auditor + synthesizer CrewAI pipeline.

    Accepts either:
    - a free-text / JSON string `clinical_context`
    - a merged clinical dict (ML1 history + ML2 lab_reports)
    - kwargs used by legacy scripts (`voice_transcript`, `ocr_data`)
    """
    if clinical_context is None and (voice_transcript is not None or ocr_data is not None or payload):
        merged: dict[str, Any] = dict(payload)
        if voice_transcript is not None:
            merged["voice_transcript"] = voice_transcript
        if ocr_data is not None:
            merged["ocr_data"] = ocr_data
        clinical_context = merged

    if clinical_context is None:
        raise ValueError("clinical_context is required")

    if isinstance(clinical_context, dict):
        context_text = _context_from_payload(clinical_context)
    else:
        context_text = str(clinical_context)

    last_rate_limit: BaseException | None = None
    for model in _ml3_model_chain():
        try:
            return _run_synthesis_for_model(context_text, model)
        except Exception as exc:
            if _is_rate_limit_error(exc):
                last_rate_limit = exc
                continue
            raise

    if last_rate_limit is not None:
        raise last_rate_limit
    raise RuntimeError("ML3 synthesis failed without a configured model")
