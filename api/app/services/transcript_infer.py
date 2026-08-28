"""Rule-based inference from chief complaint + transcript — no LLM."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import (
    _LIMB_PATTERNS,
    _PAIN_PATTERNS,
    has_trauma_context,
)

if TYPE_CHECKING:
    from app.schemas.intake import SessionState


def _normalize(blob: str) -> str:
    text = blob.lower().strip()
    text = re.sub(r"[^\w\s']", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text)


def patient_transcript_blob(session: "SessionState") -> str:
    parts: list[str] = []
    if session.chief_complaint:
        parts.append(session.chief_complaint)
    for turn in session.transcript:
        if turn.role == "patient":
            parts.append(turn.content)
    return _normalize(" ".join(parts))


def mechanism_inferable(session: "SessionState") -> bool:
    if session.mechanism:
        return True
    return has_trauma_context(patient_transcript_blob(session))


def _infer_site(blob: str) -> str | None:
    if any(re.search(p, blob) for p in _LIMB_PATTERNS):
        m = re.search(
            r"(left|right)\s+(leg|hand|arm|foot|knee|wrist|elbow|shoulder|"
            r"taang|pair|haath|baaju|ghutna)",
            blob,
        )
        if m:
            return f"{m.group(1)} {m.group(2)}"
        for pat in _LIMB_PATTERNS:
            m2 = re.search(pat, blob)
            if m2:
                return m2.group(0)
    if re.search(r"shin|calf|shine", blob):
        side = "left" if "left" in blob else "right" if "right" in blob else ""
        part = "shin" if "shin" in blob else "calf"
        return f"{side} {part}".strip()
    if re.search(r"head|sir\b|forehead", blob) and any(
        re.search(p, blob) for p in _PAIN_PATTERNS
    ):
        return "head"
    if re.search(r"lower\s+back|kamar|lumbar", blob):
        return "lower back"
    if re.search(r"chest|seena", blob):
        return "chest"
    if re.search(r"abdomen|stomach|pet\b|belly", blob):
        return "abdomen"
    return None


def _infer_mechanism(blob: str) -> str | None:
    if re.search(r"fell|fall|stairs|seedhi|gir\s*(gaya|gayi|gya|gyi)?", blob):
        return "fall"
    if re.search(r"accident|crash|collision", blob):
        return "accident"
    if re.search(r"twist|sprain|modha", blob):
        return "twist"
    if re.search(r"lift|utha|heavy", blob):
        return "heavy lifting"
    if re.search(r"hit|struck|chot", blob):
        return "injury/impact"
    if has_trauma_context(blob):
        return "injury reported"
    return None


def _infer_onset(blob: str) -> str | None:
    m = re.search(r"(\d+)\s*(din|day|days)", blob)
    if m:
        return f"{m.group(1)} days ago"
    if re.search(r"\baaj\b|today|\baj\b", blob):
        return "onset today"
    if re.search(r"achanak|sudden", blob):
        return "sudden onset"
    if re.search(r"dheere|gradual", blob):
        return "gradual onset"
    return None


def apply_transcript_inferences(session: "SessionState") -> None:
    """Pre-fill slots/extras already stated in transcript so we skip re-asking."""
    blob = patient_transcript_blob(session)
    if not blob:
        return

    if not session.chief_complaint:
        for turn in session.transcript:
            if turn.role == "patient" and turn.content.strip():
                session.chief_complaint = turn.content.strip()[:200]
                break

    data = session.slots.model_dump()
    slot_changed = False

    if not session.slots.site or session.slots.site in ("", "unclear"):
        site = _infer_site(blob)
        if site:
            data["site"] = site
            slot_changed = True

    if not session.slots.onset or session.slots.onset in ("", "unclear"):
        onset = _infer_onset(blob)
        if onset:
            data["onset"] = onset
            slot_changed = True

    if slot_changed:
        session.slots = SocratesSlots.model_validate(data)

    if not session.mechanism:
        mech = _infer_mechanism(blob)
        if mech:
            session.mechanism = mech
