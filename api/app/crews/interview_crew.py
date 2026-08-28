"""Rules-first intake assessor + Groq physician wording on advance."""

from __future__ import annotations

import logging
import re
from typing import Callable, Literal

from groq import Groq

from app.config import get_settings
from app.crews.turn_crew import (
    AnswerQuality,
    InterpreterOutput,
    _coerce_pydantic,
    _extract_json_object,
)
from app.schemas.intake import RedFlagResult, SessionState
from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import (
    ComplaintSubtype,
    PatientLanguage,
    has_trauma_context,
    reprompt_text_for,
    session_patient_language,
)
from app.services.llm import redact_pii
from app.services.slot_fill import (
    DENIAL_NONE_VALUES,
    SESSION_EXTRA_FIELDS,
    SOCRATES_FIELDS,
    coerce_severity_score,
    effective_answer_quality,
    effective_max_turns,
    filled_dimensions,
    is_affirmative,
    is_denial,
    next_subtype_dimension,
    patient_extra_value,
    patient_slot_value,
    planning_filled_dimensions,
    probe_order_for_session,
    sanitize_slots_dict,
    should_ask_dimension,
    should_store_patient_extra,
    subtype_complete,
)

logger = logging.getLogger(__name__)

MAX_REPROMPTS = 2
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")

InterviewAction = Literal["reprompt", "advance", "close"]

DIMENSION_HINTS: dict[str, str] = {
    "site": "where the problem is located on the body",
    "onset": "when symptoms started (duration, how many days)",
    "character": "what the symptom feels like (sharp, dull, burning, etc.)",
    "severity": "how severe on a 0–10 scale (number only)",
    "radiation": "whether pain/symptoms spread elsewhere",
    "associations": "other symptoms happening together",
    "time_course": "whether symptoms are constant or come and go",
    "exacerbating_relieving": "what makes it worse or better",
    "prior_medications": "medicines taken for this problem (not food requests)",
    "prior_consult": "whether they saw a doctor/clinic for this problem before",
    "pain_now": "whether pain is happening right now",
    "mechanism": "injury, fall, twist, or heavy lifting that started it",
    "bleeding_now": "whether bleeding is ongoing",
    "consciousness": "loss of consciousness or memory after injury",
    "blood_thinners": "blood-thinning medications",
    "ayush_vaya": "patient age in years (number)",
    "ayush_prakriti": "usual body constitution (hot/cold, thin/medium/heavy build)",
    "ayush_vikriti": "how they feel different from usual during this illness",
    "ayush_agni": "appetite and digestion",
    "ayush_bala": "approximate height and weight",
    "ayush_manas_vyayam": "exercise capacity and stress",
}

_DIMENSION_WRONG_HINTS: dict[str, tuple[str, ...]] = {
    "time_course": ("age", "umar", "saal", "years old", "how old", "kitni umar"),
    "onset": ("age", "umar", "saal", "years old", "how old", "kitni umar"),
    "associations": ("age", "umar", "how old", "kitni umar"),
    "severity": ("age", "umar", "how old", "kitni umar"),
    "ayush_vaya": ("lagatar", "constant", "wave", "beech beech", "aata jata"),
    "prior_medications": ("age", "umar", "how old"),
    "prior_consult": ("age", "umar", "how old"),
}


class InterviewPlan:
    def __init__(
        self,
        *,
        action: InterviewAction = "advance",
        target_dimension: str | None = None,
        assistant_message: str = "",
        complete: bool = False,
        urgent_bypass: bool = False,
        force_advance: bool = False,
    ) -> None:
        self.action = action
        self.target_dimension = target_dimension
        self.assistant_message = assistant_message
        self.complete = complete
        self.urgent_bypass = urgent_bypass
        self.force_advance = force_advance


class InterviewCrewResult:
    def __init__(
        self,
        interpreter: InterpreterOutput,
        plan: InterviewPlan,
        merged_red_flags: RedFlagResult,
    ) -> None:
        self.interpreter = interpreter
        self.plan = plan
        self.merged_red_flags = merged_red_flags


def run_interview_crew(
    session: SessionState,
    patient_text: str,
    rule_red_flags: RedFlagResult,
    *,
    subtype: ComplaintSubtype,
    probe_text_fn: Callable[[str, ComplaintSubtype], str],
    closing_message: str,
    urgent_closing_message: str,
    max_intake_turns: int,
) -> InterviewCrewResult:
    """Assess patient answer, navigate deterministically, generate contextual question."""
    assessor = _run_assessor_extraction(session, patient_text, subtype)

    quality = effective_answer_quality(
        session.last_asked_dimension,
        patient_text,
        str(assessor.get("answer_quality", "answered")),
    )
    assessor["answer_quality"] = quality

    interpreter = _assessor_to_interpreter(assessor, session)
    session.metadata["last_answer_quality"] = quality
    for note in assessor.get("inconsistencies") or []:
        if note and note not in session.metadata.setdefault("intake_inconsistencies", []):
            session.metadata["intake_inconsistencies"].append(note)

    plan = _build_plan(
        session=session,
        subtype=subtype,
        assessor=assessor,
        closing_message=closing_message,
        urgent_closing_message=urgent_closing_message,
        max_intake_turns=effective_max_turns(session, subtype, max_intake_turns),
    )

    if not plan.complete and plan.target_dimension:
        plan.assistant_message = _generate_physician_message(
            session,
            patient_text,
            subtype,
            plan,
            assessor,
            probe_text_fn,
        )

    merged = rule_red_flags.model_copy(deep=True)
    merged.source = "rules"
    return InterviewCrewResult(
        interpreter=interpreter,
        plan=plan,
        merged_red_flags=merged,
    )


def _run_assessor_extraction(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
) -> dict:
    ruled = _rule_based_assessor(session, patient_text, subtype)
    if _assessor_confident(ruled, session, patient_text):
        return ruled
    groq = _run_groq_assessor(session, patient_text, subtype)
    return groq or ruled


def _assessor_confident(
    ruled: dict,
    session: SessionState,
    patient_text: str,
) -> bool:
    """Skip Groq when rules already classified/extracted the answer."""
    quality = ruled.get("answer_quality", "answered")
    if quality in ("vague", "off_topic", "confused"):
        return True
    last = session.last_asked_dimension
    if not last:
        slots = ruled.get("slots") or {}
        return bool(ruled.get("chief_complaint") or slots)
    if quality == "denial":
        return True
    if last in SOCRATES_FIELDS:
        if last == "severity" and coerce_severity_score(patient_text) is not None:
            return True
        if patient_slot_value(last, patient_text):
            return True
        if is_denial(patient_text):
            return True
    if last in SESSION_EXTRA_FIELDS:
        if is_denial(patient_text) or is_affirmative(patient_text):
            return True
        if ruled.get(last):
            return True
    return False


def _run_groq_assessor(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
) -> dict | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    try:
        completion = Groq(api_key=settings.groq_api_key).chat.completions.create(
            model=settings.groq_llm_turn.removeprefix("groq/"),
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": "Return only valid JSON. Extraction and classification only.",
                },
                {"role": "user", "content": _slim_assessor_prompt(session, patient_text, subtype)},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        data = _extract_json_object(content)
        if data and data.get("answer_quality"):
            return data
    except Exception:
        logger.exception("Groq assessor failed")
    return None


def _rule_based_assessor(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
) -> dict:
    """No-API fallback when Groq assessor fails or rate-limits."""
    last = session.last_asked_dimension
    quality = effective_answer_quality(last, patient_text, "answered")
    data: dict = {
        "answer_quality": quality,
        "slots": {},
        "detected_language": session_patient_language(session),
        "inconsistencies": [],
    }
    if quality in ("answered", "partial", "denial") and last:
        if last in SOCRATES_FIELDS:
            if last == "severity":
                sev = coerce_severity_score(patient_text)
                if sev is not None:
                    data["slots"]["severity"] = sev
            else:
                slot_val = patient_slot_value(last, patient_text)
                if slot_val:
                    data["slots"][last] = slot_val
                elif is_denial(patient_text):
                    data["answer_quality"] = "denial"
        if last in SESSION_EXTRA_FIELDS and should_store_patient_extra(quality):
            if is_denial(patient_text):
                sentinel = DENIAL_NONE_VALUES.get(last, "none")
                if sentinel:
                    data[last] = sentinel
            else:
                data[last] = patient_extra_value(last, patient_text)
    elif not last:
        if not session.chief_complaint and patient_text.strip():
            data["chief_complaint"] = patient_text.strip()[:200]
        for key in ("site", "onset", "character"):
            val = patient_slot_value(key, patient_text)
            if val:
                data["slots"][key] = val
        if data["slots"]:
            data["answer_quality"] = "answered"
    return data


def _slim_assessor_prompt(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
) -> str:
    last = session.last_asked_dimension or "opening/chief complaint"
    hint = DIMENSION_HINTS.get(last, last)
    safe = redact_pii(patient_text)
    current = ""
    if last in SOCRATES_FIELDS:
        current = str(getattr(session.slots, last, None) or "")
    elif last in SESSION_EXTRA_FIELDS:
        current = str(getattr(session, last, None) or "")
    return (
        f"Subtype: {subtype}\n"
        f"Chief complaint: {session.chief_complaint}\n"
        f"Last asked dimension: {last} ({hint})\n"
        f"Current value for that dimension: {current or 'empty'}\n"
        f"Patient utterance: {safe}\n\n"
        "Return JSON only with keys: answer_quality, chief_complaint (if opening), "
        "slots (only fields extracted from this utterance), and the one extra field "
        "matching last asked dimension if applicable.\n"
        "answer_quality: answered|partial|vague|off_topic|confused|denial\n"
        "Rules: extract ONLY last-asked dimension unless opening (site/onset/character). "
        "severity is 0-10 only, not fever temp. No patient-facing questions."
    )


def _generate_physician_message(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
    plan: InterviewPlan,
    assessor: dict,
    probe_text_fn: Callable[[str, ComplaintSubtype], str],
) -> str:
    target = plan.target_dimension
    if not target:
        return ""

    language = session_patient_language(session)
    fallback = probe_text_fn(target, subtype)
    msg = _run_physician_groq(session, patient_text, subtype, plan, assessor, language)
    if msg and _message_matches_dimension(msg, target) and not _contains_devanagari(msg):
        return msg.strip()
    if plan.action == "reprompt":
        return (
            reprompt_text_for(target, subtype, language=language)
            or fallback
        )
    return fallback


def _language_instruction(language: PatientLanguage) -> str:
    if language == "english":
        return "English only. No Hindi or Roman Hinglish."
    return "Roman Hinglish or English. No Devanagari script."


def _dimension_hint(
    session: SessionState,
    subtype: ComplaintSubtype,
    target: str,
) -> str:
    blob = " ".join(
        filter(
            None,
            [session.chief_complaint, *(t.content for t in session.transcript if t.role == "patient")],
        )
    )
    trauma = has_trauma_context(blob, session.slots.site) or bool(
        (session.metadata or {}).get("trauma_context")
    )
    if target == "ayush_vikriti" and trauma:
        return "weakness or feeling different from usual since the injury"
    if target == "ayush_agni" and trauma:
        return "appetite or digestion only if changed since injury"
    return DIMENSION_HINTS.get(target, target)


def _run_physician_groq(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
    plan: InterviewPlan,
    assessor: dict,
    language: PatientLanguage,
) -> str | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    try:
        completion = Groq(api_key=settings.groq_api_key).chat.completions.create(
            model=settings.groq_llm_turn.removeprefix("groq/"),
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Return JSON with assistant_message only. "
                        f"{_language_instruction(language)} One sentence."
                    ),
                },
                {
                    "role": "user",
                    "content": _slim_physician_prompt(
                        session, patient_text, subtype, plan, assessor, language
                    ),
                },
            ],
        )
        content = completion.choices[0].message.content or "{}"
        data = _extract_json_object(content) or {}
        msg = (data.get("assistant_message") or "").strip()
        return msg or None
    except Exception:
        logger.exception("Groq physician message failed")
    return None


def _slim_physician_prompt(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
    plan: InterviewPlan,
    assessor: dict,
    language: PatientLanguage,
) -> str:
    target = plan.target_dimension or ""
    hint = _dimension_hint(session, subtype, target)
    filled = sorted(filled_dimensions(session))
    quality = assessor.get("answer_quality", "answered")
    action_line = (
        f"action=reprompt; patient's last answer was {quality}; "
        f"ask again for '{target}' only; do not change topic."
        if plan.action == "reprompt"
        else f"Ask ONE warm follow-up about '{target}' tied to the chief complaint."
    )
    return (
        f"Chief complaint: {session.chief_complaint}\n"
        f"Subtype: {subtype}\n"
        f"Target dimension: {target} ({hint})\n"
        f"Already filled (do NOT re-ask): {filled}\n"
        f"Patient language: {language}\n"
        f"Last patient line: {redact_pii(patient_text)}\n\n"
        f"{action_line} {_language_instruction(language)} No diagnosis.\n"
        'Return JSON: {"assistant_message": "..."}'
    )


def _assessor_to_interpreter(data: dict, session: SessionState) -> InterpreterOutput:
    slots_raw = data.get("slots") or {}
    if isinstance(slots_raw, dict):
        cleaned = sanitize_slots_dict(slots_raw)
        slots = SocratesSlots.model_validate(cleaned)
    else:
        slots = SocratesSlots()
    quality = data.get("answer_quality", "answered")
    if quality not in (
        "answered",
        "partial",
        "vague",
        "off_topic",
        "confused",
        "denial",
    ):
        quality = "answered"
    payload = {
        "chief_complaint": data.get("chief_complaint"),
        "slots": slots.model_dump(exclude_none=True),
        "allergies": data.get("allergies") or [],
        "medications": data.get("medications") or [],
        "comorbidities": data.get("comorbidities") or [],
        "prior_medications": data.get("prior_medications"),
        "prior_consult": data.get("prior_consult"),
        "pain_now": data.get("pain_now"),
        "mechanism": data.get("mechanism"),
        "bleeding_now": data.get("bleeding_now"),
        "consciousness": data.get("consciousness"),
        "blood_thinners": data.get("blood_thinners"),
        "ayush_vaya": data.get("ayush_vaya"),
        "ayush_prakriti": data.get("ayush_prakriti"),
        "ayush_vikriti": data.get("ayush_vikriti"),
        "ayush_agni": data.get("ayush_agni"),
        "ayush_bala": data.get("ayush_bala"),
        "ayush_manas_vyayam": data.get("ayush_manas_vyayam"),
        "notes": data.get("notes") or "",
        "answer_quality": quality,
        "inconsistencies": data.get("inconsistencies") or [],
        "detected_language": data.get("detected_language")
        or session_patient_language(session),
    }
    return _coerce_pydantic(payload, InterpreterOutput)


def _build_plan(
    *,
    session: SessionState,
    subtype: ComplaintSubtype,
    assessor: dict,
    closing_message: str,
    urgent_closing_message: str,
    max_intake_turns: int,
) -> InterviewPlan:
    quality: AnswerQuality = assessor.get("answer_quality", "answered")  # type: ignore[assignment]
    if quality not in ("answered", "partial", "vague", "off_topic", "confused", "denial"):
        quality = "answered"

    hit_max = session.turn_count >= max_intake_turns
    if hit_max or subtype_complete(session, subtype):
        return _close_plan(subtype, closing_message, urgent_closing_message)

    last_dim = session.last_asked_dimension
    reprompt_counts: dict[str, int] = session.metadata.setdefault("reprompt_counts", {})

    if quality in ("vague", "confused", "off_topic") and last_dim:
        count = int(reprompt_counts.get(last_dim, 0))
        if count < MAX_REPROMPTS:
            reprompt_counts[last_dim] = count + 1
            return InterviewPlan(
                action="reprompt",
                target_dimension=last_dim,
                assistant_message="",
            )
        return _advance_plan(
            session,
            subtype,
            closing_message,
            urgent_closing_message,
            force_advance=True,
            assessor=assessor,
        )

    return _advance_plan(
        session,
        subtype,
        closing_message,
        urgent_closing_message,
        force_advance=False,
        assessor=assessor,
    )


def _advance_plan(
    session: SessionState,
    subtype: ComplaintSubtype,
    closing_message: str,
    urgent_closing_message: str,
    *,
    force_advance: bool,
    assessor: dict | None = None,
) -> InterviewPlan:
    quality = (assessor or {}).get("answer_quality")
    filled = planning_filled_dimensions(
        session,
        answer_quality=str(quality) if quality else None,
        force_advance=force_advance,
    )
    next_dim = next_subtype_dimension(session, subtype, filled=filled)
    if next_dim is None:
        return _close_plan(subtype, closing_message, urgent_closing_message)

    bank = set(probe_order_for_session(session, subtype))
    if next_dim not in bank:
        return _close_plan(subtype, closing_message, urgent_closing_message)

    filled_now = filled_dimensions(session)
    if next_dim in filled_now:
        for dim in probe_order_for_session(session, subtype):
            if dim in filled_now:
                continue
            if not should_ask_dimension(dim, session, subtype):
                continue
            next_dim = dim
            break
        else:
            return _close_plan(subtype, closing_message, urgent_closing_message)

    return InterviewPlan(
        action="advance",
        target_dimension=next_dim,
        assistant_message="",
        force_advance=force_advance,
    )


def _close_plan(
    subtype: ComplaintSubtype,
    closing_message: str,
    urgent_closing_message: str,
) -> InterviewPlan:
    if subtype == "urgent_trauma":
        return InterviewPlan(
            action="close",
            assistant_message=urgent_closing_message,
            complete=True,
            urgent_bypass=True,
            force_advance=True,
        )
    return InterviewPlan(
        action="close",
        assistant_message=closing_message,
        complete=True,
        force_advance=True,
    )


def _deterministic_plan(
    session: SessionState,
    subtype: ComplaintSubtype,
    probe_text_fn: Callable[[str, ComplaintSubtype], str],
    closing_message: str,
    urgent_closing_message: str,
    max_intake_turns: int,
    *,
    force_advance: bool,
) -> InterviewPlan:
    hit_max = session.turn_count >= max_intake_turns
    if hit_max or subtype_complete(session, subtype):
        return _close_plan(subtype, closing_message, urgent_closing_message)
    next_dim = next_subtype_dimension(session, subtype)
    if next_dim is None:
        return _close_plan(subtype, closing_message, urgent_closing_message)
    bank = set(probe_order_for_session(session, subtype))
    if next_dim not in bank:
        return _close_plan(subtype, closing_message, urgent_closing_message)
    return InterviewPlan(
        action="advance",
        target_dimension=next_dim,
        assistant_message=probe_text_fn(next_dim, subtype),
        force_advance=force_advance,
    )


def _contains_devanagari(text: str) -> bool:
    return bool(_DEVANAGARI.search(text))


def _message_matches_dimension(message: str, target: str) -> bool:
    low = message.lower()
    wrong = _DIMENSION_WRONG_HINTS.get(target, ())
    if any(hint in low for hint in wrong):
        return False
    if target == "ayush_vaya":
        return any(k in low for k in ("age", "umar", "saal", "year", "old"))
    if target == "time_course":
        return any(
            k in low
            for k in (
                "lagatar",
                "constant",
                "continuous",
                "wave",
                "beech",
                "aata",
                "pattern",
                "come and go",
                "intermittent",
            )
        )
    if target == "onset":
        return any(
            k in low
            for k in ("kab", "when", "start", "din", "day", "since", "se hai", "begin")
        )
    return True
