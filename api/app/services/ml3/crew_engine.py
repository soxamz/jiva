from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv

from app.schemas.clinical_summary import PhysicianDraftSummary

load_dotenv()


def _context_from_payload(payload: dict[str, Any]) -> str:
    return json.dumps(payload, indent=2, default=str, ensure_ascii=False)


def _format_structured_context(payload: dict[str, Any]) -> str:
    """Prefer labeled ML1/ML2 sections when structured blobs are present."""
    ml1 = payload.get("ml1_histories") or []
    ml2 = payload.get("ml2_documents") or []
    if not ml1 and not ml2:
        return _context_from_payload(payload)

    sections: list[str] = []
    if ml1:
        sections.append("=== ML1: Conversational History (Voice/Chat Intake) ===")
        sections.append(json.dumps(ml1, indent=2, default=str, ensure_ascii=False))

    flat_summary = {
        k: v
        for k, v in payload.items()
        if k not in ("ml1_histories", "ml2_documents", "ocr_documents")
    }
    if flat_summary:
        sections.append("=== Merged Flat Fields (backward compat) ===")
        sections.append(json.dumps(flat_summary, indent=2, default=str, ensure_ascii=False))

    if ml2:
        sections.append("=== ML2: Digitized Medical Documents (OCR) ===")
        sections.append(json.dumps(ml2, indent=2, default=str, ensure_ascii=False))

    lab_reports = payload.get("lab_reports")
    if lab_reports:
        sections.append("=== ML2: Lab Reports (parsed) ===")
        sections.append(json.dumps(lab_reports, indent=2, default=str, ensure_ascii=False))

    return "\n\n".join(sections)


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
        context_text = _format_structured_context(clinical_context)
    else:
        context_text = str(clinical_context)

    # Lazy import so the API can boot without CrewAI installed.
    from crewai import Agent, Crew, LLM, Process, Task

    gemini_llm = LLM(
        model=os.getenv("ML3_LLM_MODEL", "openai/gemini-3.6-flash"),
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
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
            "When ML1 (conversational history) and ML2 (digitized documents) sections "
            "are present, compare them for contradictions between what the patient said "
            "and what documents record.\n"
            "List any contradictions between symptoms, history, medications, allergies, "
            "OCR/lab reports, and red flags. If none, state 'No contradictions found.'"
        ),
        expected_output="A concise list of identified clinical contradictions.",
        agent=auditor,
    )

    synthesis_task = Task(
        description=(
            "Using the clinical payload and audit results:\n"
            "When ML1 and ML2 sections are present, synthesize a single physician-ready "
            "summary that combines conversational history with digitized document findings.\n"
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
