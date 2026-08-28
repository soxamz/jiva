"""CrewAI-driven intake assessor + physician interviewer with Groq fallback."""

from __future__ import annotations

import logging
import re
from typing import Callable, Literal

from groq import Groq
from pydantic import BaseModel

from app.config import get_settings
from app.crews.turn_crew import (
    AnswerQuality,
    InterpreterOutput,
    _coerce_pydantic,
    _extract_json_object,
    _format_transcript,
    run_turn_crew,
)
from app.schemas.intake import RedFlagResult, SessionState
from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import ComplaintSubtype, probe_order_for_subtype
from app.services.llm import redact_pii
from app.services.slot_fill import (
    effective_answer_quality,
    filled_dimensions,
    next_subtype_dimension,
    sanitize_slots_dict,
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
    if assessor is None:
        turn = run_turn_crew(session, patient_text, rule_red_flags)
        plan = _deterministic_plan(
            session,
            subtype,
            probe_text_fn,
            closing_message,
            urgent_closing_message,
            max_intake_turns,
            force_advance=True,
        )
        return InterviewCrewResult(
            interpreter=turn.interpreter,
            plan=plan,
            merged_red_flags=turn.merged_red_flags,
        )

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
        max_intake_turns=max_intake_turns,
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
) -> dict | None:
    out = _run_crewai_assessor(session, patient_text, subtype)
    if out is not None:
        return out
    return _run_groq_assessor(session, patient_text, subtype)


def _run_crewai_assessor(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
) -> dict | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    try:
        from crewai import Agent, Crew, LLM, Process, Task
    except ImportError:
        return None

    try:
        groq_llm = LLM(
            model=f"groq/{settings.groq_llm_turn.removeprefix('groq/')}",
            api_key=settings.groq_api_key,
            temperature=0.1,
        )
        assessor = Agent(
            role="Intake Assessor",
            goal=(
                "Classify answer quality and extract clinical slot values for the "
                "last-asked dimension only. Do not choose the next question."
            ),
            backstory=(
                "Bilingual medical intake scribe. No diagnosis or treatment advice."
            ),
            llm=groq_llm,
            verbose=False,
            max_iter=1,
            allow_delegation=False,
        )
        assess_task = Task(
            description=_assessor_prompt(session, patient_text, subtype),
            expected_output="Valid JSON object only.",
            agent=assessor,
        )
        crew = Crew(
            agents=[assessor],
            tasks=[assess_task],
            process=Process.sequential,
            verbose=False,
        )
        crew.kickoff()
        raw = assess_task.output.raw if assess_task.output else ""
        data = _extract_json_object(str(raw)) or {}
        if data.get("answer_quality"):
            return data
    except Exception:
        logger.exception("CrewAI assessor failed; falling back to Groq")
    return None


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
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "Return only valid JSON. Extraction and classification only.",
                },
                {"role": "user", "content": _assessor_prompt(session, patient_text, subtype)},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        data = _extract_json_object(content)
        if data and data.get("answer_quality"):
            return data
    except Exception:
        logger.exception("Groq assessor failed")
    return None


def _assessor_prompt(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
) -> str:
    return (
        f"{_assessor_context(session, patient_text, subtype)}\n\n"
        "Return JSON only with keys:\n"
        "- answer_quality: answered|partial|vague|off_topic|confused|denial\n"
        "- chief_complaint, slots (SOCRATES), prior_medications, prior_consult, "
        "pain_now, mechanism, bleeding_now, consciousness, blood_thinners, "
        "ayush_* fields, allergies, medications, comorbidities\n"
        "- inconsistencies: string array\n"
        "- detected_language: en|hi|hinglish\n\n"
        "Rules: extract ONLY last-asked dimension unless opening bootstrap "
        "(site/onset/character). Denials → 'none'. severity is ONLY 0–10 score — "
        "NEVER fever temperature in severity. Do NOT generate patient-facing questions."
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

    fallback = probe_text_fn(target, subtype)
    msg = _run_physician_groq(session, patient_text, subtype, plan, assessor)
    if not msg:
        msg = _run_physician_crewai(session, patient_text, subtype, plan, assessor)

    if msg and _message_matches_dimension(msg, target) and not _contains_devanagari(msg):
        return msg.strip()
    return fallback


def _run_physician_crewai(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
    plan: InterviewPlan,
    assessor: dict,
) -> str | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    try:
        from crewai import Agent, Crew, LLM, Process, Task
    except ImportError:
        return None

    try:
        groq_llm = LLM(
            model=f"groq/{settings.groq_llm_turn.removeprefix('groq/')}",
            api_key=settings.groq_api_key,
            temperature=0.2,
        )
        physician = Agent(
            role="Intake Physician",
            goal=(
                "Ask one warm, medically relevant follow-up tied to the chief complaint."
            ),
            backstory=(
                "Real clinic intake physician. Roman Hinglish or English only. "
                "Never Devanagari. No diagnosis."
            ),
            llm=groq_llm,
            verbose=False,
            max_iter=1,
            allow_delegation=False,
        )
        task = Task(
            description=_physician_prompt(session, patient_text, subtype, plan, assessor),
            expected_output='JSON: {"assistant_message": str}',
            agent=physician,
        )
        crew = Crew(agents=[physician], tasks=[task], process=Process.sequential, verbose=False)
        crew.kickoff()
        raw = task.output.raw if task.output else ""
        data = _extract_json_object(str(raw)) or {}
        msg = (data.get("assistant_message") or "").strip()
        return msg or None
    except Exception:
        logger.exception("CrewAI physician message failed")
    return None


def _run_physician_groq(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
    plan: InterviewPlan,
    assessor: dict,
) -> str | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    try:
        completion = Groq(api_key=settings.groq_api_key).chat.completions.create(
            model=settings.groq_llm_turn.removeprefix("groq/"),
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "Return JSON with assistant_message only. Roman script.",
                },
                {
                    "role": "user",
                    "content": _physician_prompt(session, patient_text, subtype, plan, assessor),
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


def _physician_prompt(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
    plan: InterviewPlan,
    assessor: dict,
) -> str:
    target = plan.target_dimension or ""
    hint = DIMENSION_HINTS.get(target, target)
    action = plan.action
    quality = assessor.get("answer_quality", "answered")
    lang = assessor.get("detected_language", "hinglish")
    filled = sorted(filled_dimensions(session))

    if action == "reprompt":
        instruction = (
            f"The patient's answer was {quality}. Gently clarify and re-ask ONLY about "
            f"'{target}' ({hint}). Use simpler words. Do not switch topics."
        )
    else:
        instruction = (
            f"Ask ONE follow-up about '{target}' ({hint}) for this {subtype} complaint. "
            f"Tie wording to chief complaint: {session.chief_complaint!r}. "
            "Do not repeat topics already covered in transcript."
        )

    return (
        f"{_assessor_context(session, patient_text, subtype)}\n"
        f"Filled dimensions (do NOT re-ask): {filled}\n"
        f"Target dimension: {target}\n"
        f"Action: {action}\n"
        f"Patient language: {lang}\n\n"
        f"{instruction}\n\n"
        'Return JSON: {"assistant_message": "..."}\n'
        "Rules: Roman Hinglish or English ONLY — never Devanagari. "
        "One sentence. No diagnosis or treatment."
    )


def _assessor_context(
    session: SessionState,
    patient_text: str,
    subtype: ComplaintSubtype,
) -> str:
    safe_text = redact_pii(patient_text)
    bank = probe_order_for_subtype(subtype, site=session.slots.site)
    filled = sorted(filled_dimensions(session))
    return (
        f"Patient utterance (PII-redacted): {safe_text}\n"
        f"Chief complaint: {session.chief_complaint}\n"
        f"Complaint subtype: {subtype}\n"
        f"Last asked dimension: {session.last_asked_dimension}\n"
        f"Dimension hint: {DIMENSION_HINTS.get(session.last_asked_dimension or '', 'opening/chief complaint')}\n"
        f"Required probe bank (in order): {bank}\n"
        f"Already filled dimensions: {filled}\n"
        f"Current SOCRATES: {session.slots.model_dump_json()}\n"
        f"prior_medications: {session.prior_medications}\n"
        f"prior_consult: {session.prior_consult}\n"
        f"ayush_vaya: {session.ayush_vaya}\n"
        f"ayush_prakriti: {session.ayush_prakriti}\n"
        f"Transcript:\n{_format_transcript(session)}"
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
        "detected_language": data.get("detected_language") or "hinglish",
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
        )

    return _advance_plan(
        session,
        subtype,
        closing_message,
        urgent_closing_message,
        force_advance=False,
    )


def _advance_plan(
    session: SessionState,
    subtype: ComplaintSubtype,
    closing_message: str,
    urgent_closing_message: str,
    *,
    force_advance: bool,
) -> InterviewPlan:
    next_dim = next_subtype_dimension(session, subtype)
    if next_dim is None:
        return _close_plan(subtype, closing_message, urgent_closing_message)

    bank = set(probe_order_for_subtype(subtype, site=session.slots.site))
    if next_dim not in bank:
        return _close_plan(subtype, closing_message, urgent_closing_message)

    filled = filled_dimensions(session)
    if next_dim in filled:
        for dim in probe_order_for_subtype(subtype, site=session.slots.site):
            if dim not in filled:
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
    bank = set(probe_order_for_subtype(subtype, site=session.slots.site))
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
