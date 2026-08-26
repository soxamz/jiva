from __future__ import annotations

import json
import re
from typing import Any

from crewai import Crew, Process, Task

from app.agents.factories import (
    create_history_structurer_agent,
    create_physician_summarizer_agent,
)
from app.schemas.intake import PatientHistory, PhysicianSummary, SessionState
from app.services.ayush_analysis import build_ayush_block
from app.services.llm import redact_pii


class CloseCrewResult:
    def __init__(
        self,
        patient_history: PatientHistory,
        physician_summary: PhysicianSummary,
    ) -> None:
        self.patient_history = patient_history
        self.physician_summary = physician_summary


def compose_hpi_en(session: SessionState, history: PatientHistory | None = None) -> str:
    """Deterministic English HPI from filled slots with clinical phrasing."""
    h = history or _session_as_history(session, [])
    subtype = (session.metadata or {}).get("complaint_subtype") or "general"
    chief = (session.chief_complaint or h.chief_complaint or "").strip()
    onset = _clinical_en("onset", h.hpi.onset) or "onset unclear"
    sev = h.hpi.severity
    sev_txt = f"severity {sev}/10" if sev is not None else "severity not recorded"

    non_pain = subtype in ("fever", "respiratory", "gi", "general")
    # Prefer pain-style opening when site/character were actually collected
    has_pain_slots = bool(h.hpi.site) or bool(h.hpi.character)
    if non_pain and not has_pain_slots:
        problem = _chief_problem_en(chief, subtype)
        parts = [
            f"DRAFT HPI: Patient reports {problem}, {onset}, {sev_txt}."
        ]
    else:
        site = _clinical_en("site", h.hpi.site) or "unspecified site"
        character = _clinical_en("character", h.hpi.character) or "character unclear"
        parts = [
            f"DRAFT HPI: Patient reports {character} at {site}, {onset}, {sev_txt}."
        ]
    if _is_stated(h.hpi.associations):
        parts.append(
            f"Associations: {_fmt_slot(_clinical_en('associations', h.hpi.associations))}."
        )
    if _is_stated(h.hpi.time_course):
        parts.append(
            f"Time course: {_fmt_slot(_clinical_en('time_course', h.hpi.time_course))}."
        )
    if _is_stated(h.hpi.exacerbating_relieving):
        parts.append(
            "Aggravating/relieving: "
            f"{_fmt_slot(_clinical_en('exacerbating_relieving', h.hpi.exacerbating_relieving))}."
        )
    if _is_stated(h.hpi.radiation):
        parts.append(f"Radiation: {_fmt_slot(_clinical_en('radiation', h.hpi.radiation))}.")
    if _is_stated(h.pain_now):
        parts.append(f"Pain now: {_fmt_slot(_clinical_en('pain_now', h.pain_now))}.")
    if _is_stated(h.mechanism):
        parts.append(f"Mechanism/injury: {_fmt_slot(h.mechanism)}.")
    if _is_stated(h.prior_medications):
        parts.append(f"Prior medications: {_fmt_slot(h.prior_medications)}.")
    if _is_stated(h.prior_consult):
        parts.append(f"Prior consult: {_fmt_slot(h.prior_consult)}.")
    if _is_stated(h.bleeding_now):
        parts.append(f"Bleeding now: {_fmt_slot(h.bleeding_now)}.")
    if _is_stated(h.consciousness):
        parts.append(f"Consciousness after event: {_fmt_slot(h.consciousness)}.")
    if _is_stated(h.blood_thinners):
        parts.append(f"Blood thinners: {_fmt_slot(h.blood_thinners)}.")
    if h.medications:
        parts.append(f"Medications: {', '.join(h.medications)}.")
    if h.allergies:
        parts.append(f"Allergies: {', '.join(h.allergies)}.")

    ayush_parts = None
    if _session_has_ayush_probes(session):
        ayush_parts = _compose_ayush_en(h.ayush or session.ayush)
    if ayush_parts:
        parts.append(ayush_parts)

    parts.append("Clinician verification required. Not a diagnosis.")
    return " ".join(parts)


def _chief_problem_en(chief: str, subtype: str) -> str:
    """Lead HPI with the actual chief problem, not a pain placeholder."""
    low = (chief or "").lower()
    if subtype == "gi" or re.search(
        r"loose\s+motion|diarrhea|diarrhoea|vomit|ulti", low
    ):
        if re.search(r"loose\s+motion|diarrhea|diarrhoea", low):
            label = "diarrhea / loose stools"
        elif re.search(r"vomit|ulti", low):
            label = "vomiting"
        else:
            label = "gastrointestinal symptoms"
        return label
    if subtype == "fever" or re.search(r"fever|bukhar", low):
        return "fever"
    if subtype == "respiratory" or re.search(r"cough|khaansi|cold", low):
        return "respiratory symptoms (cough/cold)"
    if chief:
        return chief
    return "presenting complaint"


def _session_has_ayush_probes(session: SessionState) -> bool:
    return any(
        _is_stated(getattr(session, name, None))
        for name in (
            "ayush_vaya",
            "ayush_prakriti",
            "ayush_vikriti",
            "ayush_agni",
            "ayush_bala",
            "ayush_manas_vyayam",
        )
    )


def _compose_ayush_en(ayush) -> str | None:
    if ayush is None:
        return None
    lines: list[str] = []
    mapping = [
        ("Vaya", ayush.vaya),
        ("Prakriti", ayush.prakriti),
        ("Vikriti", ayush.vikriti),
        ("Sara", ayush.sara),
        ("Samhanana", ayush.samhanana),
        ("Pramana", ayush.pramana),
        ("Satmya", ayush.satmya),
        ("Sattva", ayush.sattva),
        ("Ahara Shakti / Agni", ayush.ahara_shakti),
        ("Vyayama Shakti", ayush.vyayama_shakti),
    ]
    for label, value in mapping:
        if not _is_stated(value):
            continue
        low = str(value).strip().lower()
        if "not stated" in low:
            continue
        lines.append(f"{label}: {_fmt_slot(value)}")
    if ayush.provisional_notes and _is_stated(ayush.provisional_notes):
        lines.append(f"Provisional notes: {ayush.provisional_notes}")
    if not lines:
        return None
    return "Dashavidha (draft): " + "; ".join(lines) + "."


def _is_stated(value: str | None) -> bool:
    if value is None or value == "":
        return False
    return str(value).strip().lower() not in {
        "unclear",
        "n/a",
        "na",
        "unknown",
        "not assessed",
    }

def _fmt_slot(value: str | None) -> str:
    """Keep patient denials explicit so they are not mistaken for unasked negatives."""
    if value is None:
        return ""
    low = str(value).strip().lower()
    if low in {"none", "no", "nil", "nothing", "null"}:
        return "denied / none reported when asked"
    if low in {"yes", "y", "haan", "haa", "ji"}:
        return "yes"
    return str(value).strip()


def _clinical_en(field: str, value: str | None) -> str | None:
    """Map common Hinglish/raw answers to short clinical English for the draft."""
    if value is None or value == "":
        return None
    raw = str(value).strip()
    low = raw.lower()

    if field == "site":
        if re.search(r"poora\s*sir|pura\s*sir|whole\s*head|entire\s*head", low):
            return "whole head"
        if re.search(r"\baage\b|forehead|frontal", low):
            return "forehead"
        if re.search(r"peeche|occipital|back\s*of\s*(the\s*)?head", low):
            return "back of head"
        if re.search(r"ek\s*taraf|one\s*side|unilateral", low):
            return "unilateral head"
        if re.search(r"lower\s*back|kamar|lumbar", low):
            return "lower back"
        if re.search(r"\bpeeth\b|\bback\b", low):
            return "back"

    if field == "onset":
        if re.search(r"dheere", low):
            return "gradual onset"
        if re.search(r"\baaj\b|today", low):
            return "onset today"
        m = re.search(r"(\d+)\s*din", low)
        if m:
            return f"onset {m.group(1)} days ago"
        m2 = re.search(r"(?:last|past|for)\s+(\d+)\s*days?", low)
        if m2:
            return f"onset {m2.group(1)} days ago"
        if re.search(r"sudden|achanak", low):
            return "sudden onset"

    if field == "character":
        if re.search(
            r"kha+sh?\s*nhi|khaas\s*nhi|nothing\s*special|only\s*headache|sirf\s*headache",
            low,
        ):
            return "nonspecific headache"
        if re.search(r"tees|throb|pulsat", low):
            return "throbbing pain"
        if re.search(r"jalan|burn", low):
            return "burning pain"
        if re.search(r"dabaav|pressure|tight", low):
            return "pressure-like pain"
        if re.search(r"dull|boojh", low):
            return "dull pain"

    if field == "associations":
        bits = []
        if re.search(r"halka\s*bukhar|mild\s*fever", low):
            bits.append("mild fever")
        elif re.search(r"bukhar|fever", low):
            bits.append("fever")
        if re.search(r"ulti|vomit", low):
            bits.append("vomiting")
        if re.search(r"kamzori|weakness", low):
            bits.append("weakness")
        if re.search(r"loose\s+motion|diarrhea|diarrhoea", low):
            bits.append("diarrhea")
        if bits:
            return ", ".join(bits)
        if re.search(r"halka\s*bukhar|mild\s*fever", low):
            return "mild fever"
        if re.search(r"bukhar|fever", low):
            return "fever"
        if re.search(r"ulti|vomit", low):
            return "vomiting"

    if field == "time_course":
        if re.search(r"wave|aata.?jata|kabhi", low):
            return "intermittent / in waves"
        if re.search(r"lagatar|constant|continuous", low):
            return "continuous"

    if field == "exacerbating_relieving":
        if re.search(r"no\s*specific|kabhi.*bad|apne\s*aap|nothing\s*specific", low):
            return "no specific triggers; fluctuates spontaneously"

    if field == "pain_now":
        if re.search(r"\btez\b|severe|zyada|bahut", low):
            return "severe"
        if re.search(r"halka|mild", low):
            return "mild"
        if re.search(r"madhyam|medium|moderate", low):
            return "moderate"

    return raw


def compose_hpi_hi(session: SessionState, history: PatientHistory | None = None) -> str:
    h = history or _session_as_history(session, [])
    subtype = (session.metadata or {}).get("complaint_subtype") or "general"
    chief = (session.chief_complaint or h.chief_complaint or "").strip()
    onset = _clinical_en("onset", h.hpi.onset) or h.hpi.onset or "शुरुआत अस्पष्ट"
    sev = h.hpi.severity
    sev_txt = f"तीव्रता {sev}/10" if sev is not None else "तीव्रता दर्ज नहीं"
    if subtype in ("fever", "respiratory", "gi", "general") and not (
        h.hpi.site or h.hpi.character
    ):
        problem = _chief_problem_en(chief, subtype)
        parts = [f"ड्राफ्ट HPI: {problem}, {onset}, {sev_txt}."]
    else:
        site = _clinical_en("site", h.hpi.site) or h.hpi.site or "स्थान अस्पष्ट"
        character = (
            _clinical_en("character", h.hpi.character) or h.hpi.character or "प्रकृति अस्पष्ट"
        )
        parts = [f"ड्राफ्ट HPI: {site} पर {character}, {onset}, {sev_txt}."]
    if _is_stated(h.hpi.associations):
        parts.append(
            f"सह लक्षण: {_fmt_slot(_clinical_en('associations', h.hpi.associations))}."
        )
    if _is_stated(h.prior_medications):
        parts.append(f"पूर्व दवाएँ: {_fmt_slot(h.prior_medications)}.")
    if _is_stated(h.prior_consult):
        parts.append(f"पूर्व परामर्श: {_fmt_slot(h.prior_consult)}.")
    if _is_stated(h.mechanism):
        parts.append(f"चोट/कारण: {_fmt_slot(h.mechanism)}.")
    ayush = h.ayush or session.ayush
    if ayush is not None and _session_has_ayush_probes(session):
        hi_bits = []
        for label, value in (
            ("वय", ayush.vaya),
            ("प्रकृति", ayush.prakriti),
            ("विकृति", ayush.vikriti),
            ("अग्नि/आहार शक्ति", ayush.ahara_shakti),
            ("प्रमाण", ayush.pramana),
            ("व्यायाम शक्ति", ayush.vyayama_shakti),
        ):
            if _is_stated(value) and "not stated" not in str(value).lower():
                hi_bits.append(f"{label}: {_fmt_slot(value)}")
        if hi_bits:
            parts.append("दशविध (ड्राफ्ट): " + "; ".join(hi_bits) + ".")
    parts.append("केवल चिकित्सक सत्यापन हेतु। निदान नहीं।")
    return " ".join(parts)


def run_close_crew(session: SessionState) -> CloseCrewResult:
    """Structure history + bilingual draft. Slot-first HPI to reduce hallucination."""
    # Always build Dashavidha block from compact probes before drafting
    session.ayush = build_ayush_block(session)

    transcript = redact_pii(
        "\n".join(f"{t.role}: {t.content}" for t in session.transcript)
    )
    slots_json = session.slots.model_dump_json()
    ayush_json = session.ayush.model_dump_json() if session.ayush else "{}"
    red_flags = sorted(
        {
            flag
            for rf in session.red_flag_history
            for flag in rf.flags
        }
    )

    seed_en = compose_hpi_en(session)
    seed_hi = compose_hpi_hi(session)

    structurer = create_history_structurer_agent()
    summarizer = create_physician_summarizer_agent()

    structure_task = Task(
        description=(
            f"Chief complaint: {session.chief_complaint}\n"
            f"SOCRATES slots JSON: {slots_json}\n"
            f"Known allergies: {session.allergies}\n"
            f"Known medications: {session.medications}\n"
            f"Known comorbidities: {session.comorbidities}\n"
            f"prior_medications: {session.prior_medications}\n"
            f"prior_consult: {session.prior_consult}\n"
            f"pain_now: {session.pain_now}\n"
            f"mechanism: {session.mechanism}\n"
            f"bleeding_now: {session.bleeding_now}\n"
            f"consciousness: {session.consciousness}\n"
            f"blood_thinners: {session.blood_thinners}\n"
            f"Dashavidha AYUSH JSON: {ayush_json}\n"
            f"Red flags seen: {red_flags}\n"
            f"Full transcript (redacted):\n{transcript}\n\n"
            "Build PatientHistory JSON with fields: chief_complaint, hpi (SOCRATES slots), "
            "allergies, medications, comorbidities, review_of_systems, "
            "prior_medications, prior_consult, pain_now, mechanism, bleeding_now, "
            "consciousness, blood_thinners, ayush (Dashavidha block from provided JSON), "
            "source_transcript_refs (short quotes), red_flags. Never diagnose. "
            "Do not invent fields that were not stated. Copy ayush from the provided JSON."
        ),
        expected_output="Valid PatientHistory JSON only.",
        agent=structurer,
        output_pydantic=PatientHistory,
    )

    summary_task = Task(
        description=(
            "Polish the following slot-based DRAFT HPI into bilingual PhysicianSummary JSON. "
            "Preserve the opening problem statement from the seed (do not invent pain at an "
            "unspecified site when the seed describes fever, diarrhea, cough, or another "
            "non-pain chief). Do NOT invent findings. Do NOT paste raw patient chat verbatim "
            "when the seed already has clinical phrasing. Keep Dashavidha concise — omit "
            "fields marked not stated; do not repeat the same sentence under multiple labels.\n\n"
            f"EN seed:\n{seed_en}\n\nHI seed:\n{seed_hi}\n\n"
            "Return PhysicianSummary JSON with: en, hi, is_draft=true, disclaimer, "
            "highlights[] (short bullets from seed only), red_flags[]. "
            "No treatment orders. No definitive diagnosis."
        ),
        expected_output="Valid PhysicianSummary JSON only.",
        agent=summarizer,
        context=[structure_task],
        output_pydantic=PhysicianSummary,
    )

    crew = Crew(
        agents=[structurer, summarizer],
        tasks=[structure_task, summary_task],
        process=Process.sequential,
        verbose=False,
    )
    crew.kickoff()

    history = _coerce(
        structure_task.output.pydantic if structure_task.output else None,
        PatientHistory,
        fallback=_fallback_history(session, red_flags, transcript),
    )
    # Never trust LLM-invented clinical fields — bind HPI/extras to session only
    history = _bind_history_to_session(history, session, red_flags)
    # Prefer re-compose from final history so EN always has specifics
    template = _fallback_summary(session, history, red_flags)
    summary = _coerce(
        summary_task.output.pydantic if summary_task.output else None,
        PhysicianSummary,
        fallback=template,
    )
    # Always prefer deterministic slot-first HPI body (prevents invented negatives)
    summary.en = template.en
    summary.hi = template.hi
    if not summary.highlights:
        summary.highlights = template.highlights
    summary.is_draft = True
    if not summary.disclaimer:
        summary.disclaimer = PhysicianSummary.model_fields["disclaimer"].default
    if not summary.red_flags:
        summary.red_flags = red_flags
    return CloseCrewResult(patient_history=history, physician_summary=summary)


def _session_as_history(session: SessionState, red_flags: list[str]) -> PatientHistory:
    ayush = session.ayush or build_ayush_block(session)
    return PatientHistory(
        chief_complaint=session.chief_complaint,
        hpi=session.slots,
        allergies=session.allergies,
        medications=session.medications,
        comorbidities=session.comorbidities,
        prior_medications=session.prior_medications,
        prior_consult=session.prior_consult,
        pain_now=session.pain_now,
        mechanism=session.mechanism,
        bleeding_now=session.bleeding_now,
        consciousness=session.consciousness,
        blood_thinners=session.blood_thinners,
        ayush=ayush,
        red_flags=red_flags,
    )


def _bind_history_to_session(
    history: PatientHistory,
    session: SessionState,
    red_flags: list[str],
) -> PatientHistory:
    """Overwrite inventable clinical fields from session ground truth."""
    history.chief_complaint = session.chief_complaint or history.chief_complaint
    history.hpi = session.slots
    history.allergies = session.allergies or history.allergies
    history.medications = session.medications or history.medications
    history.comorbidities = session.comorbidities or history.comorbidities
    history.prior_medications = session.prior_medications
    history.prior_consult = session.prior_consult
    history.pain_now = session.pain_now
    history.mechanism = session.mechanism
    history.bleeding_now = session.bleeding_now
    history.consciousness = session.consciousness
    history.blood_thinners = session.blood_thinners
    history.ayush = session.ayush or build_ayush_block(session)
    history.red_flags = red_flags or history.red_flags
    return history


def _fallback_history(
    session: SessionState,
    red_flags: list[str],
    transcript: str,
) -> PatientHistory:
    refs = [line[:120] for line in transcript.splitlines() if line.startswith("patient:")][:5]
    history = _session_as_history(session, red_flags)
    history.source_transcript_refs = refs
    return history


def _fallback_summary(
    session: SessionState,
    history: PatientHistory,
    red_flags: list[str],
) -> PhysicianSummary:
    en = compose_hpi_en(session, history)
    if red_flags:
        en += f" Red flags: {', '.join(red_flags)}."
    hi = compose_hpi_hi(session, history)
    highlights = [
        x
        for x in [
            history.chief_complaint,
            f"site={history.hpi.site}" if history.hpi.site else None,
            f"severity={history.hpi.severity}" if history.hpi.severity is not None else None,
        ]
        if x
    ]
    return PhysicianSummary(
        en=en,
        hi=hi,
        highlights=highlights,
        red_flags=red_flags,
    )


def _coerce(value: Any, model: type, fallback: Any):
    if isinstance(value, model):
        return value
    if value is not None:
        try:
            if isinstance(value, dict):
                return model.model_validate(value)
            return model.model_validate_json(str(value))
        except Exception:
            pass
    if isinstance(value, str):
        parsed = _extract_json(value)
        if parsed:
            try:
                return model.model_validate(parsed)
            except Exception:
                pass
    return fallback


def _extract_json(text: str) -> dict | None:
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except Exception:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except Exception:
            return None
