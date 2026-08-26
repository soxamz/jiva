from __future__ import annotations

import json
import re
from typing import Any

from groq import Groq
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schemas.intake import RedFlagResult, SessionState
from app.schemas.socrates import SocratesSlots
from app.services.llm import redact_pii


class InterpreterOutput(BaseModel):
    chief_complaint: str | None = None
    slots: SocratesSlots = Field(default_factory=SocratesSlots)
    allergies: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    comorbidities: list[str] = Field(default_factory=list)
    prior_medications: str | None = None
    prior_consult: str | None = None
    pain_now: str | None = None
    mechanism: str | None = None
    bleeding_now: str | None = None
    consciousness: str | None = None
    blood_thinners: str | None = None
    ayush_vaya: str | None = None
    ayush_prakriti: str | None = None
    ayush_vikriti: str | None = None
    ayush_agni: str | None = None
    ayush_bala: str | None = None
    ayush_manas_vyayam: str | None = None
    notes: str = ""


class TurnCrewResult(BaseModel):
    interpreter: InterpreterOutput
    merged_red_flags: RedFlagResult


def run_turn_crew(
    session: SessionState,
    patient_text: str,
    rule_red_flags: RedFlagResult,
) -> TurnCrewResult:
    """Run interpret-only. Question selection is deterministic in IntakeFlow."""
    safe_text = redact_pii(patient_text)
    transcript_blob = _format_transcript(session)
    slots_json = session.slots.model_dump_json()

    prompt = (
        f"Patient utterance (PII-redacted):\n{safe_text}\n\n"
            f"Current chief complaint: {session.chief_complaint}\n"
            f"Current SOCRATES slots JSON: {slots_json}\n"
            f"Last asked dimension: {session.last_asked_dimension}\n"
            f"prior_medications: {session.prior_medications}\n"
            f"prior_consult: {session.prior_consult}\n"
            f"pain_now: {session.pain_now}\n"
            f"mechanism: {session.mechanism}\n"
            f"bleeding_now: {session.bleeding_now}\n"
            f"consciousness: {session.consciousness}\n"
            f"blood_thinners: {session.blood_thinners}\n"
            f"ayush_vaya: {session.ayush_vaya}\n"
            f"ayush_prakriti: {session.ayush_prakriti}\n"
            f"ayush_vikriti: {session.ayush_vikriti}\n"
            f"ayush_agni: {session.ayush_agni}\n"
            f"ayush_bala: {session.ayush_bala}\n"
            f"ayush_manas_vyayam: {session.ayush_manas_vyayam}\n"
            f"Prior transcript:\n{transcript_blob}\n\n"
            "Extract updates only for the Last asked dimension. "
            "Do NOT invent or fill unasked SOCRATES or AYUSH fields with 'none' or guesses. "
            "Do NOT map mild/halka/severe adjectives to a numeric severity unless the "
            "patient stated an explicit 0–10 number. "
            "For clear patient denials of the LAST ASKED field only "
            "(e.g. no radiation, no meds, Nhi/Nhii/no), write the string "
            '"none" (or "no" for pain_now / "stopped" for bleeding stopped / '
            '"not assessed" for ayush_* denials). '
            "Also extract prior_medications, prior_consult, pain_now, mechanism, "
            "bleeding_now, consciousness, blood_thinners, and ayush_* fields ONLY when "
            "that field was last asked or clearly volunteered in this utterance.\n"
            "Return JSON matching: "
            '{"chief_complaint": str|null, "slots": {...}, "allergies": [], '
            '"medications": [], "comorbidities": [], '
            '"prior_medications": str|null, "prior_consult": str|null, '
            '"pain_now": str|null, "mechanism": str|null, '
            '"bleeding_now": str|null, '
            '"consciousness": str|null, "blood_thinners": str|null, '
            '"ayush_vaya": str|null, "ayush_prakriti": str|null, '
            '"ayush_vikriti": str|null, "ayush_agni": str|null, '
            '"ayush_bala": str|null, "ayush_manas_vyayam": str|null, "notes": str}'
    )
    interpreter_out = _interpret_with_groq(prompt)

    # Rules own hard triage; LLM triage is off the hot path for MVP speed.
    merged = rule_red_flags.model_copy(deep=True)
    merged.source = "rules"
    return TurnCrewResult(
        interpreter=interpreter_out,
        merged_red_flags=merged,
    )


def _interpret_with_groq(prompt: str) -> InterpreterOutput:
    """Use Groq directly instead of bundling the CrewAI/LiteLLM orchestration stack."""
    settings = get_settings()
    if not settings.groq_api_key:
        return InterpreterOutput()

    try:
        completion = Groq(api_key=settings.groq_api_key).chat.completions.create(
            model=settings.groq_llm_turn.removeprefix("groq/"),
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "Return only valid JSON matching the requested schema.",
                },
                {"role": "user", "content": prompt},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        return _coerce_pydantic(None, InterpreterOutput, content)
    except Exception:
        # The deterministic intake flow still captures the active probe answer.
        return InterpreterOutput()


def _format_transcript(session: SessionState) -> str:
    if not session.transcript:
        return "(empty)"
    lines = [f"{t.role}: {t.content}" for t in session.transcript[-12:]]
    return "\n".join(lines)


def _coerce_pydantic(value: Any, model: type, raw: Any = None, default: Any = None):
    if isinstance(value, model):
        return value
    if value is not None:
        try:
            if isinstance(value, dict):
                return model.model_validate(value)
            return model.model_validate_json(str(value))
        except Exception:
            pass
    if raw is not None:
        parsed = _extract_json_object(str(raw))
        if parsed:
            try:
                return model.model_validate(parsed)
            except Exception:
                pass
    if default is not None:
        return default
    return model()


def _extract_json_object(text: str) -> dict | None:
    text = text.strip()
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, dict) else None
    except Exception:
        return None
