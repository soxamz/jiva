"""Deterministic SOCRATES denial fill and pathway-aware next-dimension helpers."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import (
    ComplaintSubtype,
    Pathway,
    probe_order_for_pathway,
    probe_order_for_subtype,
)

if TYPE_CHECKING:
    from app.schemas.intake import SessionState

REQUIRED_ORDER = [
    "site",
    "onset",
    "character",
    "severity",
    "radiation",
    "associations",
]

SOCRATES_FIELDS = {
    "site",
    "onset",
    "character",
    "radiation",
    "associations",
    "time_course",
    "exacerbating_relieving",
    "severity",
}

SESSION_EXTRA_FIELDS = {
    "prior_medications",
    "prior_consult",
    "pain_now",
    "mechanism",
    "bleeding_now",
    "consciousness",
    "blood_thinners",
    "ayush_vaya",
    "ayush_prakriti",
    "ayush_vikriti",
    "ayush_agni",
    "ayush_bala",
    "ayush_manas_vyayam",
}

DENIAL_NONE_VALUES = {
    "radiation": "none",
    "associations": "none",
    "exacerbating_relieving": "none",
    "time_course": "none",
    "character": "unclear",
    "site": "unclear",
    "onset": "unclear",
    "severity": None,
    "prior_medications": "none",
    "prior_consult": "none",
    "pain_now": "no",
    "mechanism": "none",
    "bleeding_now": "stopped",
    "consciousness": "none",
    "blood_thinners": "none",
    "ayush_vaya": "not assessed",
    "ayush_prakriti": "not assessed",
    "ayush_vikriti": "not assessed",
    "ayush_agni": "not assessed",
    "ayush_bala": "not assessed",
    "ayush_manas_vyayam": "not assessed",
}

_DENIAL_PATTERNS = [
    r"^no$",
    r"^nope$",
    r"^nah$",
    r"^none$",
    r"^nothing$",
    r"^nil$",
    r"^nhi+$",
    r"^nahi+$",
    r"^naa+$",
    r"^na$",
    r"^not\s+really$",
    r"^no\s+not\s+really$",
    r"^not\s+kind\s*of+$",
    r"^not\s+kind\s*off$",
    r"^kind\s*of\s+no$",
    r"^no\s+i\s+said",
    r"^i\s+said\s+(no|nhi|earlier)",
    r"^no\s+radiation$",
    r"^doesn'?t\s+spread$",
    r"^does\s+not\s+spread$",
    r"^fail\s+nahi",
    r"^phail\s+nahi",
]


def is_denial(text: str) -> bool:
    normalized = _normalize(text)
    if not normalized:
        return False
    for pattern in _DENIAL_PATTERNS:
        if re.search(pattern, normalized):
            return True
    tokens = set(normalized.split())
    negatives = {"no", "nope", "nah", "nhi", "nahi", "none", "nothing", "nil"}
    if tokens and tokens <= negatives | {"really", "not", "kind", "of", "off", "kinda"}:
        if tokens & negatives or "not" in tokens:
            return True
    return False


def is_sentinel_none(value: object) -> bool:
    """True for denial/empty sentinels including stringified None/null."""
    if value is None:
        return True
    return str(value).strip().lower() in {
        "none",
        "null",
        "nil",
        "n/a",
        "na",
        "nothing",
        "no",
        "not assessed",
    }


def is_affirmative(text: str) -> bool:
    normalized = _normalize(text)
    if not normalized:
        return False
    if re.fullmatch(r"(yes|y|yeah|yep|haa+|haan+|han|ji|haan\s*ji|haa\s*ji)", normalized):
        return True
    if re.match(r"^(yes|yeah|yep|haa+|haan+|ji)\b", normalized):
        return True
    return False


def should_store_patient_extra(answer_quality: str | None) -> bool:
    """Do not persist off-topic chat into clinical extra fields."""
    if answer_quality is None:
        return True
    return answer_quality not in ("off_topic", "vague", "confused")


def should_finalize_dimension(
    answer_quality: str | None,
    *,
    force_advance: bool,
) -> bool:
    """Only mark a dimension done (incl. unclear sentinel) when advancing, not reprompting."""
    if force_advance:
        return True
    if answer_quality is None:
        return True
    return answer_quality in ("answered", "partial", "denial")


def patient_slot_value(dimension: str, patient_text: str) -> str | None:
    """Rule-based SOCRATES capture for short obvious clinical answers."""
    text = patient_text.strip()
    if not text:
        return None
    low = text.lower()

    if dimension == "site" and len(text) > 2:
        if re.search(
            r"shin|calf|leg|taang|hand|arm|baaju|pair|knee|wrist|foot|shoulder|"
            r"back|peeth|head|sir|forehead|abdomen|pet|chest|middle",
            low,
        ):
            return text[:200]

    if dimension == "time_course":
        if re.search(
            r"lagatar|lagataar|constant|continuous|steady|same\s+all\s+day",
            low,
        ):
            return "continuous"
        if re.search(
            r"wave|aata.?jata|beech.?beech|intermittent|kabhi.?kabhi|comes?\s+and\s+goes",
            low,
        ):
            return "intermittent / in waves"
        if re.search(r"^lagatar\s*h?$", low):
            return "continuous"

    if dimension == "onset":
        m = re.search(r"(\d+)\s*(din|day|days)", low)
        if m:
            return f"{m.group(1)} days ago"
        if re.search(r"\baaj\b|today|this\s+morning", low):
            return "onset today"
        if re.search(r"achanak|sudden", low):
            return "sudden onset"
        if re.search(r"dheere|gradual", low):
            return "gradual onset"

    if dimension == "associations" and len(text) > 2:
        if is_affirmative(text) or re.search(
            r"bukhar|fever|pain|dard|khaansi|cough|ulti|vomit|shiver|thand",
            low,
        ):
            return text[:200]

    return None


_FOOD_REQUEST_PATTERNS = [
    r"burger",
    r"pizza",
    r"coffee",
    r"coffe",
    r"give me food",
    r"hungryyyy",
    r"im hungry",
    r"happy day",
    r"its a happy",
]

_OFF_TOPIC_PATTERNS = [
    r"^abcd+$",
    r"^xyz+$",
    r"^test+$",
    r"^asdf",
    r"^qwerty",
    r"papa said",
    r"mom said",
    r"dad said",
    r"mummy said",
    r"uncle said",
    r"give me burger",
]

_FAMILY_EDUCATION_PATTERNS = [
    r"study well",
    r"become.*engineer",
    r"\bschool\b",
    r"\bteacher\b",
    r"papa said",
    r"mom said",
    r"dad said",
    r"mummy said",
    r"father said",
    r"mother said",
]

_CLINICAL_TOKEN_RE = re.compile(
    r"\d|fever|pain|dard|bukhar|doctor|clinic|hospital|nausea|vomit|"
    r"bleed|injury|fall|leg|hand|arm|weak|swell|yes|no|none|sharp|dull"
)

_GIBBERISH_HINTS = (
    r"amar munnaay",
    r"munnaay dosh",
    r"in the shiva",
    r"still hot af",
    r"pant me huggu",
)


def _is_family_education_chatter(text: str) -> bool:
    low = _normalize(text)
    if not any(re.search(p, low) for p in _FAMILY_EDUCATION_PATTERNS):
        return False
    return not _CLINICAL_TOKEN_RE.search(low)


def _expects_clinical_answer(dimension: str) -> bool:
    return (
        dimension in SOCRATES_FIELDS
        or dimension.startswith("ayush_")
        or dimension in {
            "prior_medications",
            "prior_consult",
            "mechanism",
            "bleeding_now",
            "consciousness",
            "blood_thinners",
            "pain_now",
        }
    )


def _looks_like_gibberish(text: str) -> bool:
    low = _normalize(text)
    if not low or len(low) < 3:
        return True
    for pat in _OFF_TOPIC_PATTERNS:
        if re.search(pat, low):
            return True
    for pat in _GIBBERISH_HINTS:
        if re.search(pat, low):
            return True
    words = low.split()
    if len(words) >= 2 and not re.search(
        r"\d|fever|pain|dard|bukhar|kg|ft|year|saal|din|day|leg|hand|arm",
        low,
    ):
        vowel_ratio = sum(1 for c in low if c in "aeiou") / max(len(low), 1)
        if vowel_ratio < 0.15 or vowel_ratio > 0.85:
            return True
    return False


def _valid_extra_answer(dimension: str, patient_text: str) -> bool:
    text = patient_text.strip()
    if not text:
        return False
    low = text.lower()
    if dimension == "ayush_vaya":
        m = re.search(r"\b(\d{1,3})\b", text)
        return m is not None and 0 < int(m.group(1)) <= 120
    if dimension == "ayush_bala":
        return bool(re.search(r"\d|kg|ft|cm|weight|height|patla|mazboot|bhari", low))
    if dimension == "prior_consult":
        if re.search(r"papa|maa|dad|mom|uncle|aunty|family", low) and not re.search(
            r"doctor|clinic|hospital|dr\.?", low
        ):
            return False
        return bool(
            re.search(r"doctor|clinic|hospital|dr\.?|yes|no|nahi|nhi|haan", low)
            or is_denial(text)
            or is_affirmative(text)
        )
    if dimension == "prior_medications":
        if re.search(r"what do you mean|kya matlab|samjha nahi", low):
            return False
        return len(text) >= 2
    if dimension.startswith("ayush_"):
        if any(re.search(p, low) for p in _FOOD_REQUEST_PATTERNS):
            return False
        if re.search(r"uncle says|still hot af", low):
            return False
        return len(text) >= 2 and not _looks_like_gibberish(text)
    if dimension in {"bleeding_now", "consciousness", "blood_thinners", "pain_now"}:
        return is_denial(text) or is_affirmative(text) or len(text) >= 2
    return len(text) >= 2


def rule_based_answer_quality(
    last_asked_dimension: str | None,
    patient_text: str,
) -> str | None:
    """Deterministic quality when LLM is wrong; None = defer to LLM."""
    if not last_asked_dimension:
        return None
    text = patient_text.strip()
    if not text:
        return "vague"
    low = text.lower()

    if any(re.search(p, low) for p in _FOOD_REQUEST_PATTERNS):
        return "off_topic"
    if any(re.search(p, low) for p in _OFF_TOPIC_PATTERNS):
        return "off_topic"
    if _expects_clinical_answer(last_asked_dimension) and _is_family_education_chatter(text):
        return "off_topic"
    if re.search(r"what do you mean|kya matlab|samjha nahi|huh\b|idk|i don'?t know", low):
        return "confused"
    if last_asked_dimension == "prior_consult" and re.search(
        r"papa|maa|dad|mom|uncle|aunty", low
    ) and not re.search(r"doctor|clinic|hospital", low):
        return "vague"

    if last_asked_dimension in ("ayush_vaya", "severity"):
        if not re.search(r"\d", low) and (
            _is_family_education_chatter(text) or _looks_like_gibberish(text)
        ):
            return "off_topic" if _is_family_education_chatter(text) else "vague"

    if last_asked_dimension == "severity":
        if has_explicit_severity(text):
            return "answered"
        if is_denial(text):
            return "denial"
        if not re.search(r"\d", low) and _looks_like_gibberish(text):
            return "vague"

    if last_asked_dimension in SOCRATES_FIELDS:
        if patient_slot_value(last_asked_dimension, text):
            return "answered"
        if is_denial(text):
            return "denial"
        if last_asked_dimension == "severity" and not has_explicit_severity(text):
            return "vague"

    if last_asked_dimension in SESSION_EXTRA_FIELDS:
        if is_denial(text):
            return "denial"
        if is_affirmative(text) and last_asked_dimension in {
            "pain_now",
            "bleeding_now",
            "consciousness",
            "blood_thinners",
            "prior_consult",
        }:
            return "answered"
        if _valid_extra_answer(last_asked_dimension, text):
            return "answered"
        if _looks_like_gibberish(text):
            return "vague"

    return None


def effective_answer_quality(
    last_asked_dimension: str | None,
    patient_text: str,
    llm_quality: str,
) -> str:
    """Override vague LLM quality when rule extract succeeds."""
    ruled = rule_based_answer_quality(last_asked_dimension, patient_text)
    if ruled:
        return ruled
    if last_asked_dimension in SOCRATES_FIELDS:
        if patient_slot_value(last_asked_dimension, patient_text):
            return "answered"
    if last_asked_dimension in SESSION_EXTRA_FIELDS:
        if _valid_extra_answer(last_asked_dimension, patient_text):
            return "answered"
    return llm_quality


def patient_extra_value(dimension: str, patient_text: str) -> str:
    """Normalize patient utterance into a session-extra value."""
    text = patient_text.strip()
    if dimension == "prior_consult":
        if is_affirmative(text):
            return "yes"
        return text[:200]
    if dimension in {"pain_now", "bleeding_now", "consciousness", "blood_thinners", "mechanism"}:
        if is_affirmative(text):
            return "yes"
        return text[:200]
    if dimension == "prior_medications":
        cleaned = re.sub(
            r"^(haa+|haan+|yes|yeah|yep|ji)\s*[,:\-]?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()
        return (cleaned or text)[:200]
    if dimension.startswith("ayush_"):
        return text[:240]
    return text[:200]


def apply_denial_fill(
    slots: SocratesSlots,
    patient_text: str,
    last_asked_dimension: str | None,
) -> SocratesSlots:
    if not last_asked_dimension or last_asked_dimension not in SOCRATES_FIELDS:
        return slots
    if not is_denial(patient_text):
        return slots
    if last_asked_dimension == "severity":
        return slots
    if last_asked_dimension in slots.filled_fields():
        return slots

    value = DENIAL_NONE_VALUES.get(last_asked_dimension, "none")
    if value is None:
        return slots
    data = slots.model_dump()
    data[last_asked_dimension] = value
    return SocratesSlots.model_validate(data)


def apply_session_denial_fill(
    session: "SessionState",
    patient_text: str,
    last_asked_dimension: str | None,
) -> None:
    if not last_asked_dimension or last_asked_dimension not in SESSION_EXTRA_FIELDS:
        return
    if not is_denial(patient_text):
        return
    current = getattr(session, last_asked_dimension, None)
    if current is not None and current != "":
        return
    value = DENIAL_NONE_VALUES.get(last_asked_dimension, "none")
    setattr(session, last_asked_dimension, value)


def force_fill_unclear(
    slots: SocratesSlots,
    dimension: str,
) -> SocratesSlots:
    if dimension not in SOCRATES_FIELDS:
        return slots
    if dimension in slots.filled_fields():
        return slots
    data = slots.model_dump()
    if dimension == "severity":
        data["severity"] = 5
    else:
        data[dimension] = "unclear"
    return SocratesSlots.model_validate(data)


def force_fill_session_unclear(session: "SessionState", dimension: str) -> None:
    if dimension not in SESSION_EXTRA_FIELDS:
        return
    current = getattr(session, dimension, None)
    if current is not None and current != "":
        return
    setattr(session, dimension, DENIAL_NONE_VALUES.get(dimension, "unclear") or "unclear")


def has_explicit_severity(text: str) -> bool:
    """True only when patient states a 0–10 score (not mild/severe adjectives or fever temps)."""
    if not text or not text.strip():
        return False
    t = text.lower().strip()
    if re.search(r"°|fahrenheit|\bf\b|celsius|centigrade", t):
        return False
    if re.fullmatch(r"10|[0-9]", t):
        return int(t) <= 10
    m = re.search(r"\b(10|[0-9])\s*/\s*10\b", t)
    if m:
        return int(m.group(1)) <= 10
    m = re.search(r"\b(10|[0-9])\s*out\s*of\s*10\b", t)
    if m:
        return int(m.group(1)) <= 10
    return False


def coerce_severity_score(value: object) -> int | None:
    """Map LLM/patient value to 0–10; drop fever temperatures and out-of-range numbers."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 10 else None
    if isinstance(value, float):
        whole = int(value)
        return whole if 0 <= whole <= 10 else None
    text = str(value).strip().lower()
    if not text:
        return None
    if re.search(r"°|fahrenheit|\bf\b|celsius|centigrade", text):
        return None
    m = re.search(r"\b(10|[0-9])\s*/\s*10\b", text)
    if m:
        n = int(m.group(1))
        return n if 0 <= n <= 10 else None
    m = re.search(r"\b(10|[0-9])\s*out\s*of\s*10\b", text)
    if m:
        n = int(m.group(1))
        return n if 0 <= n <= 10 else None
    if re.fullmatch(r"10|[0-9]", text):
        n = int(text)
        return n if 0 <= n <= 10 else None
    m = re.search(r"\b(\d{1,2})\b", text)
    if m:
        n = int(m.group(1))
        if 0 <= n <= 10:
            return n
    return None


def sanitize_slots_dict(raw: dict) -> dict:
    """Drop/normalize slot fields before SocratesSlots validation."""
    out = dict(raw)
    if "severity" in out:
        coerced = coerce_severity_score(out["severity"])
        if coerced is None:
            out.pop("severity", None)
        else:
            out["severity"] = coerced
    return out


# Complaint-defining fields allowed on the opening turn before any probe is asked.
_BOOTSTRAP_SLOTS = frozenset({"site", "onset", "character"})


def restrict_interpreter_slots(
    interpreted: SocratesSlots,
    last_asked_dimension: str | None,
    patient_text: str,
) -> SocratesSlots:
    """Drop unasked slot invents — only last-asked (or bootstrap) may be written.

    Severity may update only when last asked was severity, or the patient gave an
    explicit 0–10 number in the same utterance.
    """
    src = interpreted.model_dump(exclude_none=True)
    allowed: dict = {}

    if last_asked_dimension and last_asked_dimension in SOCRATES_FIELDS:
        if last_asked_dimension in src:
            allowed[last_asked_dimension] = src[last_asked_dimension]
        if (
            last_asked_dimension != "severity"
            and "severity" in src
            and has_explicit_severity(patient_text)
        ):
            allowed["severity"] = src["severity"]
    elif not last_asked_dimension:
        for key in _BOOTSTRAP_SLOTS:
            if key in src and src[key] not in (None, ""):
                allowed[key] = src[key]
        if "severity" in src and has_explicit_severity(patient_text):
            allowed["severity"] = src["severity"]

    return SocratesSlots.model_validate(allowed)


def restrict_interpreter_extras(
    extras: dict[str, str | None],
    last_asked_dimension: str | None,
) -> dict[str, str]:
    """Only accept session extras for the dimension that was just asked."""
    out: dict[str, str] = {}
    if not last_asked_dimension or last_asked_dimension not in SESSION_EXTRA_FIELDS:
        return out
    value = extras.get(last_asked_dimension)
    if value is not None and value != "":
        out[last_asked_dimension] = value
    return out


def filled_dimensions(session: "SessionState") -> set[str]:
    filled = set(session.slots.filled_fields())
    for name in SESSION_EXTRA_FIELDS:
        value = getattr(session, name, None)
        if value is None or value == "":
            continue
        if str(value).strip().lower() == "not assessed":
            continue
        filled.add(name)
    return filled


def planning_filled_dimensions(
    session: "SessionState",
    *,
    answer_quality: str | None,
    force_advance: bool,
) -> set[str]:
    """Dimensions treated as filled when choosing the next probe (plan runs before apply)."""
    filled = filled_dimensions(session)
    last = session.last_asked_dimension
    if last and should_finalize_dimension(answer_quality, force_advance=force_advance):
        filled.add(last)
    return filled


def next_required_dimension(slots: SocratesSlots) -> str | None:
    filled = set(slots.filled_fields())
    for dim in REQUIRED_ORDER:
        if dim not in filled:
            return dim
    return None


def _trauma_context(session: "SessionState") -> bool:
    return bool((session.metadata or {}).get("trauma_context"))


def probe_order_for_session(
    session: "SessionState", subtype: ComplaintSubtype
) -> list[str]:
    """Active probe bank for this session (trauma screens + relevant AYUSH only)."""
    from app.services.intake_pathways import relevant_ayush_dimensions

    order = probe_order_for_subtype(
        subtype,
        site=session.slots.site,
        trauma_context=_trauma_context(session),
    )
    ayush_allowed = set(relevant_ayush_dimensions(session, subtype))
    filtered: list[str] = []
    for dim in order:
        if dim.startswith("ayush_"):
            if dim in ayush_allowed:
                filtered.append(dim)
        else:
            filtered.append(dim)
    return filtered


def effective_max_turns(
    session: "SessionState",
    subtype: ComplaintSubtype,
    configured_max: int,
) -> int:
    """Ensure configured cap does not close intake before AYUSH/trauma bank is reachable."""
    needed = len(probe_order_for_session(session, subtype)) + 4
    return max(configured_max, needed)


def next_pathway_dimension(session: "SessionState", pathway: Pathway) -> str | None:
    order = probe_order_for_pathway(pathway, site=session.slots.site)
    filled = filled_dimensions(session)
    for dim in order:
        if dim not in filled:
            return dim
    return None


def should_ask_dimension(
    dim: str,
    session: "SessionState",
    subtype: ComplaintSubtype,
) -> bool:
    """Skip dimensions already filled or clinically irrelevant for this session."""
    from app.services.intake_pathways import (
        PAIN_ONLY_DIMS,
        denies_pain_frame,
        relevant_ayush_dimensions,
        should_ask_radiation,
    )
    from app.services.transcript_infer import mechanism_inferable

    if dim in filled_dimensions(session):
        return False
    if dim.startswith("ayush_"):
        return dim in relevant_ayush_dimensions(session, subtype)
    if dim == "radiation" and not should_ask_radiation(session.slots.site):
        return False
    if dim == "mechanism" and mechanism_inferable(session):
        return False
    chief = session.chief_complaint or ""
    if dim in PAIN_ONLY_DIMS and denies_pain_frame(chief):
        return False
    return True


def next_subtype_dimension(
    session: "SessionState",
    subtype: ComplaintSubtype,
    *,
    filled: set[str] | None = None,
) -> str | None:
    order = probe_order_for_session(session, subtype)
    if filled is None:
        filled = filled_dimensions(session)
    for dim in order:
        if dim in filled:
            continue
        if not should_ask_dimension(dim, session, subtype):
            continue
        return dim
    return None


def pathway_complete(session: "SessionState", pathway: Pathway) -> bool:
    return next_pathway_dimension(session, pathway) is None


def subtype_complete(session: "SessionState", subtype: ComplaintSubtype) -> bool:
    return next_subtype_dimension(session, subtype) is None


def core_complete(slots: SocratesSlots) -> bool:
    return next_required_dimension(slots) is None


def progress_map(
    session: "SessionState",
    subtype: ComplaintSubtype | None = None,
) -> dict[str, bool]:
    """Only show dimensions in the active bank (plus any already filled in-bank)."""
    from app.services.intake_pathways import ALL_SUBTYPES

    if subtype is None:
        raw = session.metadata.get("complaint_subtype") or session.metadata.get("pathway")
        if raw in ALL_SUBTYPES:
            subtype = raw  # type: ignore[assignment]
        else:
            subtype = "general"

    order = probe_order_for_session(session, subtype)  # type: ignore[arg-type]
    filled = filled_dimensions(session)
    result: dict[str, bool] = {}
    for dim in order:
        result[dim] = dim in filled
    return result


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s']", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text
