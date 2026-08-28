"""Deterministic Dashavidha mapper + light provisional AYUSH notes."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from app.schemas.intake import AyushBlock

if TYPE_CHECKING:
    from app.schemas.intake import SessionState

_NOT_ASSESSED = frozenset({"", "none", "null", "n/a", "na", "not assessed", "unclear"})


def build_ayush_block(session: "SessionState") -> AyushBlock:
    """Expand compact probe answers into full Dashavidha fields + provisional notes."""
    vaya = _normalize_vaya(_stated(session.ayush_vaya))
    prakriti = _normalize_prakriti(_stated(session.ayush_prakriti))
    vikriti_ans = _normalize_short(_stated(session.ayush_vikriti))
    agni = _normalize_agni(_stated(session.ayush_agni))
    bala = _stated(session.ayush_bala)
    manas = _stated(session.ayush_manas_vyayam)

    sara, samhanana, pramana = _split_bala(bala)
    sattva, satmya, vyayama = _split_manas(manas)
    vikriti = _merge_vikriti(session, vikriti_ans)

    block = AyushBlock(
        prakriti=prakriti,
        vikriti=vikriti,
        sara=sara,
        samhanana=samhanana,
        pramana=pramana,
        satmya=satmya,
        sattva=sattva,
        ahara_shakti=agni,
        vyayama_shakti=vyayama,
        vaya=vaya,
        # Legacy mirrors for older consumers
        prakriti_notes=prakriti,
        agni_notes=agni,
        ahara_vihara=agni,
    )
    block.provisional_notes = provisional_ayush_notes(block, session=session)
    return block


_AYUSH_PROBE_FIELDS = (
    "ayush_vaya",
    "ayush_prakriti",
    "ayush_vikriti",
    "ayush_agni",
    "ayush_bala",
    "ayush_manas_vyayam",
)


def _was_asked(session: "SessionState | None", field: str) -> bool:
    if session is None:
        return False
    asked = session.metadata.get("asked_dimensions") or []
    if field in asked:
        return True
    return getattr(session, field, None) not in (None, "")


def provisional_ayush_notes(
    block: AyushBlock,
    *,
    session: "SessionState | None" = None,
) -> str:
    """Keyword-only draft hypotheses — never invent a dosha without cues."""
    cues: list[str] = []
    blob = " ".join(
        filter(
            None,
            [
                block.prakriti,
                block.vikriti,
                block.ahara_shakti,
                block.sattva,
                block.satmya,
                block.vyayama_shakti,
                block.sara,
                block.samhanana,
                block.pramana,
                block.vaya,
            ],
        )
    ).lower()

    if not blob.strip():
        return "Insufficient Dashavidha cues for provisional typing. Clinician verification required."

    # Agni
    if re.search(
        r"low\s*appetite|poor\s*appetite|kam\s*bhookh|weak\s*appetite|"
        r"der\s*se\s*hazam|slow\s*digest|gas|acidity|mand|no\s*appetite|"
        r"bhukh\s*nahi|bhookh\s*nhi",
        blob,
    ):
        cues.append("Agni appears low / irregular (draft from appetite/digestion cues).")
    elif re.search(r"tez\s*bhookh|strong\s*appetite|hunger\s*strong|atikshudha", blob):
        cues.append("Agni appears strong / sharp (draft from appetite cues).")

    # Rough Prakriti/Vikriti leaning — only with explicit cues
    vata_hits = bool(
        re.search(r"thanda|cold|dry|ruksha|patla|thin|anxiety|stress|vayu|vata", blob)
    )
    pitta_hits = bool(
        re.search(r"garam|heat|hot|jalan|acidity|anger|pitta|tez\s*bhookh", blob)
    )
    kapha_hits = bool(
        re.search(r"bhari|heavy|oily|snigdha|swelling|lethargy|kapha|slow", blob)
    )
    leanings = []
    if vata_hits:
        leanings.append("Vata-leaning cues")
    if pitta_hits:
        leanings.append("Pitta-leaning cues")
    if kapha_hits:
        leanings.append("Kapha-leaning cues")
    if leanings:
        cues.append(
            "Provisional constitution/imbalance signals: "
            + "; ".join(leanings)
            + " (not a diagnosis)."
        )
    else:
        prakriti_asked = _was_asked(session, "ayush_prakriti")
        vikriti_asked = _was_asked(session, "ayush_vikriti")
        if prakriti_asked or vikriti_asked:
            cues.append(
                "Prakriti/Vikriti: patient answer unclear or insufficient — "
                "verify with patient."
            )
        elif session is not None and any(
            _was_asked(session, f) for f in _AYUSH_PROBE_FIELDS
        ):
            cues.append(
                "Prakriti/Vikriti: not assessed in this intake (not asked)."
            )

    # Concise facts only — avoid repeating raw multi-field paste
    if block.vaya and re.search(r"\d+", block.vaya):
        cues.append(f"Age/Vaya: {block.vaya}.")
    if block.pramana and block.pramana != block.sara:
        cues.append(f"Pramana: {block.pramana}.")
    if block.vyayama_shakti and "not stated" not in (block.vyayama_shakti or "").lower():
        cues.append(f"Exercise tolerance: {block.vyayama_shakti}.")

    cues.append("DRAFT for clinician verification only — not a diagnosis.")
    return " ".join(cues)


def _stated(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in _NOT_ASSESSED:
        return None
    return text


def _normalize_vaya(vaya: str | None) -> str | None:
    if not vaya:
        return None
    m = re.search(r"(\d{1,3})\s*(years?|yrs?|saal|y/?o)?", vaya.lower())
    if m:
        return f"{m.group(1)} years"
    return vaya.strip()


def _normalize_prakriti(text: str | None) -> str | None:
    if not text:
        return None
    low = text.lower().strip()
    if low in {"normal", "average", "madhyam", "usual", "ok", "theek"}:
        return "average / unremarkable (patient-stated)"
    return text.strip()


def _normalize_short(text: str | None) -> str | None:
    if not text:
        return None
    low = text.lower().strip()
    if re.search(r"none\s+of\s+these|kuch\s+nahi|nothing|no\s+change", low):
        return "no additional constitutional change stated"
    return text.strip()


def _normalize_agni(text: str | None) -> str | None:
    if not text:
        return None
    low = text.lower()
    parts: list[str] = []
    if re.search(r"bhukh\s*nhi|bhookh\s*nhi|no\s*appetite|poor\s*appetite|bilkul\s*bhookh", low):
        parts.append("poor appetite currently")
    if re.search(r"vomit|ulti", low):
        parts.append("appetite reduced in setting of vomiting")
    if re.search(r"usually\s+normal|normal\s+hazm|usual.*normal", low):
        parts.append("baseline digestion usually normal")
    if re.search(r"gas|acidity|acid", low):
        parts.append("gas/acidity")
    if parts:
        return "; ".join(parts)
    return text.strip()


def _split_bala(bala: str | None) -> tuple[str | None, str | None, str | None]:
    """Map combined build answer → only the fields the answer actually supports."""
    if not bala:
        return None, None, None
    low = bala.lower()
    sara: str | None = None
    samhanana: str | None = None
    pramana: str | None = None

    height = re.search(r"(\d+(?:\.\d+)?)\s*(ft|feet|cm|'|’)", low)
    weight = re.search(r"(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram)", low)
    if height or weight or re.search(r"height|weight|tall|short", low):
        bits = []
        if height:
            unit = height.group(2).replace("feet", "ft").replace("'", "ft")
            bits.append(f"height ~{height.group(1)} {unit}")
        if weight:
            bits.append(f"weight ~{weight.group(1)} kg")
        pramana = ", ".join(bits) if bits else f"body size noted: {bala.strip()}"

    if re.search(r"firm|soft|compact|mazboot|dense", low):
        samhanana = bala.strip()
    if re.search(r"\bpatla\b|\bthin\b|\bmazboot\b|\bstrong\b|muscle|joint|tissue|taaqat", low):
        if not re.search(r"height|weight|ft|kg", low) or re.search(
            r"patla|thin|mazboot|strong|muscle|joint", low
        ):
            sara = bala.strip() if not (height or weight) else (
                "build cues limited; height/weight given under Pramana"
            )

    # Height/weight-only answers must NOT clone into Sara/Samhanana
    if pramana and not sara and not samhanana:
        return None, None, pramana
    if not any([sara, samhanana, pramana]):
        return None, None, f"build stated: {bala.strip()}"
    return sara, samhanana, pramana


def _split_manas(manas: str | None) -> tuple[str | None, str | None, str | None]:
    """Map combined mind/adapt/exercise answer → only stated facets."""
    if not manas:
        return None, None, None
    low = manas.lower()
    sattva: str | None = None
    satmya: str | None = None
    vyayama: str | None = None

    if re.search(r"stress|mann|mind|anxiety|worry|tension|sattva|mental", low):
        sattva = manas.strip()
    if re.search(r"climate|khana|food|adapt|satmya|weather|change\s+se", low):
        satmya = manas.strip()
    if re.search(r"exercise|walk|chalna|vyayam|endurance|stamina|workout|gym", low):
        if re.search(r"mild|light|halka", low):
            vyayama = "mild / light exercise tolerance (regular)"
        elif re.search(r"moderate|madhyam", low):
            vyayama = "moderate exercise tolerance (regular)"
        elif re.search(r"heavy|intense|zyada", low):
            vyayama = "good / high exercise tolerance"
        else:
            vyayama = "exercise present; intensity not further graded"

    # Exercise-only answer: do not clone into Sattva/Satmya
    if vyayama and not sattva and not satmya:
        return "not stated in this answer", "not stated in this answer", vyayama
    if not any([sattva, satmya, vyayama]):
        return None, None, None
    return sattva, satmya, vyayama


def _merge_vikriti(session: "SessionState", vikriti_ans: str | None) -> str | None:
    seeds: list[str] = []
    if session.chief_complaint:
        seeds.append(f"complaint={session.chief_complaint}")
    if session.slots.associations:
        seeds.append(f"associations={session.slots.associations}")
    if session.slots.character:
        seeds.append(f"character={session.slots.character}")
    if session.slots.site:
        seeds.append(f"site={session.slots.site}")
    seed_txt = "; ".join(seeds) if seeds else None
    if vikriti_ans and seed_txt:
        return f"{vikriti_ans} (HPI context: {seed_txt})"
    return vikriti_ans or seed_txt
