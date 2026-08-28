"""Deterministic intake pathway / complaint-subtype classification and probe banks."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.schemas.intake import SessionState

PatientLanguage = Literal["english", "hinglish"]

# Broad buckets still used by some call sites
Pathway = Literal["urgent_trauma", "pain", "general"]

# Fine-grained banks for physician-like questioning
ComplaintSubtype = Literal[
    "urgent_trauma",
    "headache",
    "limb_pain",
    "abdominal_pain",
    "chest_pain_soft",
    "pain",
    "fever",
    "respiratory",
    "gi",
    "general",
]

ALL_SUBTYPES: tuple[str, ...] = (
    "urgent_trauma",
    "headache",
    "limb_pain",
    "abdominal_pain",
    "chest_pain_soft",
    "pain",
    "fever",
    "respiratory",
    "gi",
    "general",
)

_NON_PAIN_STICKY = frozenset({"fever", "respiratory", "gi", "general", "abdominal_pain"})
_PAIN_FAMILY = frozenset(
    {"headache", "limb_pain", "abdominal_pain", "chest_pain_soft", "pain"}
)

_RADIATION_SITE_HINTS = (
    "chest",
    "seene",
    "dil",
    "back",
    "peeth",
    "neck",
    "gardan",
    "shoulder",
    "arm",
    "baaju",
    "abdomen",
    "pet",
    "belly",
    "spine",
    "lower back",
    "upper back",
)

_MECHANISM_SITE_HINTS = (
    "back",
    "peeth",
    "spine",
    "lumbar",
    "lower back",
    "upper back",
    "neck",
    "gardan",
    "shoulder",
    "knee",
    "ghutna",
    "wrist",
    "ankle",
    "hip",
    "hand",
    "haath",
    "haat",
    "arm",
    "baaju",
    "leg",
    "pair",
    "taang",
    "foot",
)

_URGENT_PATTERNS = [
    r"\bbleed",
    r"\bkhoon\b",
    r"\bfell\b",
    r"\bfall\b",
    r"\bstairs?\b",
    r"\baccident\b",
    r"\binjur",
    r"\btrauma\b",
    r"\bhead\s+injur",
    r"\bchot\b",
    r"\bgir\s*(gaya|gayi|gya|gyi)?\b",
    r"\bseedhi\b",
    r"\bwound\b",
    r"\bfracture\b",
    r"\bbroken\b",
    r"\bhit\s+(my|the)\s+head\b",
    r"\bsir\s+(mein|me)\s+chot\b",
]

_FEVER_PATTERNS = [
    r"\bfever\b",
    r"\bfeverish\b",
    r"\bbukhar\b",
    r"\bbukhaar\b",
    r"\bhigh\s+(body\s+)?temp",
    r"\btemperature\b",
    r"\bpyrexia\b",
]

_RESPIRATORY_PATTERNS = [
    r"\bcough\b",
    r"\bkhaansi\b",
    r"\bkansi\b",
    r"\bcold\b",
    r"\bflu\b",
    r"\bsaans\b",
    r"\bbreath",
    r"\bbalgam\b",
    r"\bsputum\b",
    r"\bwheeze\b",
]

_HEADACHE_PATTERNS = [
    r"\bheadache\b",
    r"\bmigraine\b",
    r"\bsir\s*(dard|mein|me|pe)\b",
    r"\bhead\s*(pain|pe|mein|me)\b",
    r"\bsiren\b",
    r"\bhigh\s+headache\b",
]

_LIMB_PATTERNS = [
    r"\bhand\b",
    r"\barm\b",
    r"\bleg\b",
    r"\bfoot\b",
    r"\bknee\b",
    r"\bwrist\b",
    r"\belbow\b",
    r"\bshoulder\b",
    r"\bfinger\b",
    r"\bhaath\b",
    r"\bhaat\b",
    r"\bbaaju\b",
    r"\bpair\b",
    r"\btaang\b",
    r"\bghutna\b",
]

_GI_PATTERNS = [
    r"\bloose\s+motion",
    r"\bloose\s+stool",
    r"\bdiarrhea\b",
    r"\bdiarrhoea\b",
    r"\bdysentery\b",
    r"\bvomit",
    r"\bulti\b",
    r"\buliti\b",
    r"\bnausea\b",
    r"\bmatli\b",
    r"\bgastro\b",
    r"\bfood\s+poison",
    r"\bpet\s+kharab",
    r"\bindigestion\b",
    r"\bconstipation\b",
    r"\bqabz\b",
]

_ABDOMEN_PATTERNS = [
    r"\babdomen\b",
    r"\bstomach\b",
    r"\bbelly\b",
    r"\bpet\b",
    r"\bepigastr",
    r"\bumbilic",
    r"\bpet\s+dard",
    r"\bstomach\s+ache",
    r"\bstomach\s+pain",
    r"\babdominal\s+pain",
]

_CHEST_PATTERNS = [
    r"\bchest\b",
    r"\bseene\b",
    r"\bseenay\b",
]

_PAIN_PATTERNS = [
    r"\bpain\b",
    r"\bdard\b",
    r"\bache\b",
    r"\baching\b",
    r"\btees\b",
    r"\bjalan\b",
    r"\bsoreness\b",
    r"\bcramp\b",
]

_PAIN_DENIAL_PATTERNS = [
    r"\bno\s+dard\b",
    r"\bnhi+\s+dard\b",
    r"\bnahi+\s+dard\b",
    r"\bnot\s+pain\b",
    r"\bno\s+pain\b",
    r"\bonly\s+(fever|bukhar|cough|khaansi)\b",
    r"\bsirf\s+(bukhar|fever|khaansi|cough)\b",
    r"\bno\s+dard\s+only\b",
]

_CHIEF_CHANGE_PATTERNS = [
    r"\bonly\s+(fever|bukhar|cough|khaansi|loose\s+motion|diarrhea|diarrhoea)\b",
    r"\bsirf\s+(bukhar|fever|khaansi|cough|loose\s+motion|ulti)\b",
    r"\bi\s+have\s+(fever|bukhar|cough|loose\s+motion|diarrhea)\b",
    r"\bmujhe\s+(bukhar|fever|khaansi|loose\s+motion|ulti)\b",
]

_NEW_SYMPTOM_PATTERNS = [
    r"\bbukhar\b",
    r"\bfever\b",
    r"\bpet\b",
    r"\bstomach\b",
    r"\babdomen\b",
    r"\buliti\b",
    r"\bvomit",
    r"\bchakkar\b",
    r"\bdizz",
    r"\bcough\b",
    r"\bkhaansi\b",
    r"\bpain\b",
    r"\bdard\b",
    r"\bhand\b",
    r"\bhaath\b",
    r"\bhaat\b",
    r"\barm\b",
    r"\bswelling\b",
    r"\bsoojan\b",
    r"\bnumb",
    r"\bbhi\s+h",
    r"\balso\b",
]

# Dims that are pain-questionnaire specific (skip when patient denies pain frame)
PAIN_ONLY_DIMS = frozenset(
    {
        "character",
        "radiation",
        "exacerbating_relieving",
        "pain_now",
        "mechanism",
        "time_course",
    }
)

PRIORS = ["prior_medications", "prior_consult"]

DASHAVIDHA_ORDER = [
    "ayush_vaya",
    "ayush_prakriti",
    "ayush_vikriti",
    "ayush_agni",
    "ayush_bala",
    "ayush_manas_vyayam",
]

_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
_HINGLISH_TOKEN_RE = re.compile(
    r"\b(nahi|nahin|hai|hain|mein|main|kya|kab|batayein|bataye|bukhar|dard|"
    r"khaansi|ulti|pet|sir|haan|haa|ji|mujhe|mera|meri|aap|tum|lagataar|"
    r"halka|zyada|din|se|chot|girna|pair|haath)\b"
)
_AGNI_CUE_RE = re.compile(
    r"bhookh|bhukh|appetite|hazma|digest|nausea|vomit|ulti|gas|acidity|"
    r"fullness|khana|food|agni"
)
_BALA_CUE_RE = re.compile(
    r"\bkg\b|\bft\b|weight|height|patla|mazboot|bhari|bala|build"
)
_PRAKRITI_CUE_RE = re.compile(
    r"garam|thanda|hot|cold|patla|madhyam|bhari|prakriti|constitution"
)


def _patient_transcript_blob(session: "SessionState", latest_text: str = "") -> str:
    parts: list[str] = []
    if session.chief_complaint:
        parts.append(session.chief_complaint)
    for turn in session.transcript:
        if turn.role == "patient":
            parts.append(turn.content)
    if latest_text.strip():
        parts.append(latest_text)
    return _normalize(" ".join(parts))


def detect_patient_language(
    session: "SessionState",
    latest_text: str,
) -> PatientLanguage:
    """Infer whether patient is writing in English or Roman Hinglish."""
    blob = _patient_transcript_blob(session, latest_text)
    if not blob.strip():
        return "hinglish"
    if _DEVANAGARI_RE.search(blob):
        return "hinglish"
    low = blob.lower()
    hinglish_hits = len(_HINGLISH_TOKEN_RE.findall(low))
    words = re.findall(r"[a-z]+", low)
    if hinglish_hits == 0 and blob.isascii():
        return "english"
    if hinglish_hits >= 2 or (words and hinglish_hits / len(words) >= 0.08):
        return "hinglish"
    return "english"


def update_session_language(session: "SessionState", latest_text: str) -> PatientLanguage:
    lang = detect_patient_language(session, latest_text)
    session.metadata["patient_language"] = lang
    return lang


def session_patient_language(session: "SessionState") -> PatientLanguage:
    stored = session.metadata.get("patient_language")
    if stored in ("english", "hinglish"):
        return stored  # type: ignore[return-value]
    return "hinglish"


def _order_ayush_dims(dims: list[str]) -> list[str]:
    allowed = set(dims)
    return [d for d in DASHAVIDHA_ORDER if d in allowed]


def relevant_ayush_dimensions(
    session: "SessionState",
    subtype: ComplaintSubtype,
) -> list[str]:
    """Complaint-relevant Dashavidha probes — not always all six."""
    if subtype == "urgent_trauma":
        return []

    blob = _patient_transcript_blob(session)
    trauma = bool((session.metadata or {}).get("trauma_context")) or has_trauma_context(
        blob, session.slots.site
    )
    agni_cues = bool(_AGNI_CUE_RE.search(blob))
    bala_cues = bool(_BALA_CUE_RE.search(blob))
    prakriti_cues = bool(_PRAKRITI_CUE_RE.search(blob))

    if subtype in ("fever", "respiratory", "gi"):
        return list(DASHAVIDHA_ORDER)

    if trauma or (subtype == "limb_pain" and trauma):
        dims = ["ayush_vaya", "ayush_vikriti", "ayush_bala", "ayush_manas_vyayam"]
        if agni_cues:
            dims.append("ayush_agni")
        return _order_ayush_dims(dims)

    if subtype in ("headache", "pain", "abdominal_pain", "chest_pain_soft", "limb_pain"):
        dims = ["ayush_vaya", "ayush_prakriti", "ayush_vikriti", "ayush_manas_vyayam"]
        if agni_cues or subtype == "abdominal_pain":
            dims.append("ayush_agni")
        if bala_cues:
            dims.append("ayush_bala")
        return _order_ayush_dims(dims)

    # general and fallback
    dims = ["ayush_vaya", "ayush_vikriti", "ayush_agni", "ayush_manas_vyayam"]
    if prakriti_cues:
        dims.append("ayush_prakriti")
    if bala_cues:
        dims.append("ayush_bala")
    return _order_ayush_dims(dims)


def classify_pathway(text: str, existing: Pathway | None = None) -> Pathway:
    """Broad pathway for backward compatibility."""
    subtype = classify_complaint_subtype(
        text, existing_subtype=_pathway_to_subtype(existing)
    )
    if subtype == "urgent_trauma":
        return "urgent_trauma"
    if subtype in _PAIN_FAMILY:
        return "pain"
    return "general"


def has_trauma_context(text: str, site: str | None = None) -> bool:
    blob = _normalize(" ".join(filter(None, [text, site or ""])))
    return any(re.search(p, blob) for p in _URGENT_PATTERNS)


def _blob_has_limb_pain(blob: str) -> bool:
    has_limb = any(re.search(p, blob) for p in _LIMB_PATTERNS)
    if not has_limb:
        return False
    has_pain = any(re.search(p, blob) for p in _PAIN_PATTERNS)
    has_trauma = any(re.search(p, blob) for p in _URGENT_PATTERNS)
    return has_pain or has_trauma


def classify_complaint_subtype(
    text: str,
    existing_subtype: ComplaintSubtype | None = None,
    site: str | None = None,
) -> ComplaintSubtype:
    """Chief-complaint aware classification with sticky non-pain banks."""
    blob = _normalize(" ".join(filter(None, [text, site or ""])))

    if has_trauma_context(text, site):
        if _blob_has_limb_pain(blob):
            return "limb_pain"
        return "urgent_trauma"
    if existing_subtype == "urgent_trauma":
        if _blob_has_limb_pain(blob):
            return "limb_pain"
        if site and any(re.search(p, _normalize(site)) for p in _LIMB_PATTERNS):
            return "limb_pain"
        return "urgent_trauma"

    detected = _detect_subtype_from_blob(blob)

    # Sticky non-pain chief: secondary "body pain" must not flip the bank
    if existing_subtype in _NON_PAIN_STICKY:
        if detected in _NON_PAIN_STICKY and detected != existing_subtype:
            # Allow explicit chief change fever <-> respiratory
            if _looks_like_chief_change(blob):
                return detected
        if detected in _PAIN_FAMILY and not _looks_like_chief_change(blob):
            return existing_subtype
        if detected is None or detected == "pain":
            return existing_subtype
        return existing_subtype

    if detected is not None:
        return detected

    if existing_subtype in _PAIN_FAMILY:
        return existing_subtype
    if existing_subtype in ("fever", "respiratory", "gi", "general"):
        return existing_subtype
    return "general"


def _detect_subtype_from_blob(blob: str) -> ComplaintSubtype | None:
    """Order: specific non-pain before generic pain."""
    if any(re.search(p, blob) for p in _FEVER_PATTERNS):
        return "fever"
    if any(re.search(p, blob) for p in _RESPIRATORY_PATTERNS):
        return "respiratory"
    if any(re.search(p, blob) for p in _HEADACHE_PATTERNS):
        return "headache"
    # GI (diarrhea/vomiting) before abdomen-pain bank
    if any(re.search(p, blob) for p in _GI_PATTERNS):
        return "gi"
    if any(re.search(p, blob) for p in _ABDOMEN_PATTERNS) and any(
        re.search(p, blob) for p in _PAIN_PATTERNS
    ):
        return "abdominal_pain"
    if any(re.search(p, blob) for p in _ABDOMEN_PATTERNS):
        return "gi"
    if any(re.search(p, blob) for p in _CHEST_PATTERNS):
        return "chest_pain_soft"
    if any(re.search(p, blob) for p in _LIMB_PATTERNS):
        return "limb_pain"
    if any(re.search(p, blob) for p in _PAIN_PATTERNS):
        return "pain"
    return None


def denies_pain_frame(text: str) -> bool:
    blob = _normalize(text)
    return any(re.search(p, blob) for p in _PAIN_DENIAL_PATTERNS)


def asserts_non_pain_chief(text: str) -> ComplaintSubtype | None:
    """If utterance clearly asserts fever/respiratory/GI as the issue, return that subtype."""
    blob = _normalize(text)
    if denies_pain_frame(blob) or _looks_like_chief_change(blob):
        if any(re.search(p, blob) for p in _FEVER_PATTERNS):
            return "fever"
        if any(re.search(p, blob) for p in _RESPIRATORY_PATTERNS):
            return "respiratory"
        if any(re.search(p, blob) for p in _GI_PATTERNS):
            return "gi"
    if any(re.search(p, blob) for p in _GI_PATTERNS) and denies_pain_frame(blob):
        return "gi"
    return None


def _looks_like_chief_change(blob: str) -> bool:
    return any(re.search(p, blob) for p in _CHIEF_CHANGE_PATTERNS)


def should_ask_radiation(site: str | None) -> bool:
    if not site:
        return False
    s = site.lower()
    return any(h in s for h in _RADIATION_SITE_HINTS)


def should_ask_mechanism(site: str | None) -> bool:
    if not site:
        return False
    s = site.lower()
    return any(h in s for h in _MECHANISM_SITE_HINTS)


def _core_then_ayush(core: list[str]) -> list[str]:
    """Short clinical core → Dashavidha → priors (AYUSH prioritized)."""
    return [*core, *DASHAVIDHA_ORDER, *PRIORS]


def probe_order_for_subtype(
    subtype: ComplaintSubtype,
    site: str | None = None,
    *,
    trauma_context: bool = False,
) -> list[str]:
    if subtype == "urgent_trauma":
        return ["site", "bleeding_now", "consciousness", "blood_thinners"]

    if subtype == "fever":
        return _core_then_ayush(
            ["onset", "severity", "associations", "time_course"]
        )

    if subtype == "respiratory":
        return _core_then_ayush(
            ["onset", "severity", "associations", "time_course"]
        )

    if subtype == "gi":
        return _core_then_ayush(
            ["onset", "severity", "associations", "time_course"]
        )

    if subtype == "general":
        return _core_then_ayush(["onset", "severity", "associations"])

    if subtype == "headache":
        return _core_then_ayush(
            [
                "site",
                "onset",
                "character",
                "severity",
                "associations",
                "time_course",
                "exacerbating_relieving",
            ]
        )

    if subtype == "limb_pain":
        core: list[str] = ["site", "onset", "mechanism"]
        if trauma_context:
            core.extend(["bleeding_now", "consciousness", "blood_thinners"])
        core.extend(
            ["character", "severity", "associations", "exacerbating_relieving"]
        )
        return _core_then_ayush(core)

    if subtype == "abdominal_pain":
        return _core_then_ayush(
            [
                "site",
                "onset",
                "character",
                "severity",
                "associations",
                "exacerbating_relieving",
            ]
        )

    if subtype == "chest_pain_soft":
        return _core_then_ayush(
            [
                "site",
                "onset",
                "character",
                "severity",
                "radiation",
                "associations",
            ]
        )

    if subtype == "pain":
        core = ["site", "onset"]
        if should_ask_mechanism(site):
            core.append("mechanism")
        core.extend(["character", "severity"])
        if should_ask_radiation(site):
            core.append("radiation")
        core.extend(["associations", "exacerbating_relieving"])
        return _core_then_ayush(core)

    return _core_then_ayush(["onset", "severity", "associations"])


def probe_order_for_pathway(pathway: Pathway, site: str | None = None) -> list[str]:
    """Legacy wrapper — prefer probe_order_for_subtype."""
    if pathway == "urgent_trauma":
        return probe_order_for_subtype("urgent_trauma", site)
    if pathway == "pain":
        subtype = classify_complaint_subtype(site or "", site=site)
        if subtype in ("headache", "limb_pain", "abdominal_pain", "chest_pain_soft"):
            return probe_order_for_subtype(subtype, site)
        return probe_order_for_subtype("pain", site)
    return probe_order_for_subtype("general", site)


def probe_question_for(dim: str, subtype: ComplaintSubtype) -> str | None:
    """Subtype-specific wording — problem language, not always dard."""
    overrides: dict[tuple[str, ComplaintSubtype], str] = {
        # --- fever ---
        ("onset", "fever"): "Bukhar kab se hai — aaj, kuch din pehle, ya dheere-dheere?",
        ("severity", "fever"): (
            "0 se 10 mein, bukhar / bechaini kitni zyada feel ho rahi hai abhi?"
        ),
        ("associations", "fever"): (
            "Saath mein thand-lagna, khaansi, ulti, gardan akad, "
            "ya peshab mein jalan hai?"
        ),
        ("time_course", "fever"): (
            "Bukhar lagatar hai ya aata-jata / waves mein? Kab zyada hota hai?"
        ),
        ("prior_medications", "fever"): (
            "Bukhar ke liye koi dawai le rahe ho / le chuke ho (paracetamol, etc.)?"
        ),
        ("prior_consult", "fever"): (
            "Is bukhar ke liye pehle kisi doctor se mil chuke ho?"
        ),
        # --- respiratory ---
        ("onset", "respiratory"): (
            "Khaansi / saans ki problem kab se hai — aaj, kuch din, ya dheere-dheere?"
        ),
        ("severity", "respiratory"): (
            "0 se 10 mein, khaansi / saans ki dikkat kitni severe hai abhi?"
        ),
        ("associations", "respiratory"): (
            "Saath mein bukhar, balgam, seene mein dard, ya saans phoolna hai?"
        ),
        ("time_course", "respiratory"): (
            "Khaansi din-raat kab zyada hai — lagatar ya attack / waves mein?"
        ),
        ("prior_medications", "respiratory"): (
            "Khaansi / cold ke liye koi dawai le rahe ho / le chuke ho?"
        ),
        # --- GI (loose motion / vomiting) ---
        ("onset", "gi"): (
            "Yeh pet ki problem (loose motion / ulti) kab se hai — "
            "aaj, kuch din pehle, ya dheere-dheere?"
        ),
        ("severity", "gi"): (
            "0 se 10 mein, loose motion / ulti abhi kitni zyada takleef de rahi hai?"
        ),
        ("associations", "gi"): (
            "Saath mein bukhar, pet dard, kamzori, ya khoon / paani jaisa stool hai?"
        ),
        ("time_course", "gi"): (
            "Din mein kitni baar loose motion / ulti ho rahi hai — "
            "lagatar ya beech-beech mein?"
        ),
        ("prior_medications", "gi"): (
            "Pet / loose motion ke liye koi dawai le rahe ho (ORS, pantop, etc.)?"
        ),
        ("prior_consult", "gi"): (
            "Is pet ki problem ke liye pehle kisi doctor se mil chuke ho?"
        ),
        # --- general ---
        ("onset", "general"): (
            "Yeh pareshani kab shuru hui — aaj, kuch din pehle, ya dheere-dheere?"
        ),
        ("severity", "general"): (
            "0 se 10 mein, yeh problem abhi kitni severe feel ho rahi hai?"
        ),
        ("associations", "general"): (
            "Saath mein bukhar, ulti, kamzori, khaansi, ya koi aur symptom hai?"
        ),
        ("prior_medications", "general"): (
            "Is problem ke liye koi dawai le rahe ho / le chuke ho?"
        ),
        # --- headache ---
        (
            "associations",
            "headache",
        ): "Saath mein bukhar, ulti, light se dikkat, ya gardan mein akad hai?",
        (
            "site",
            "headache",
        ): "Sir mein dard kahan zyada hai — aage, peeche, ek taraf, ya poora sir?",
        (
            "exacerbating_relieving",
            "headache",
        ): "Kis se sir dard badhta hai (light, shor, stress)? Kis se aaram?",
        # --- limb ---
        (
            "associations",
            "limb_pain",
        ): "Haath/pair mein sujan, sunn pan, ya rang change hua hai?",
        (
            "mechanism",
            "limb_pain",
        ): "Chot, accident, twist, ya heavy lifting hua tha kya?",
        # --- abdomen ---
        (
            "associations",
            "abdominal_pain",
        ): "Saath mein ulti, loose motions, bukhar, ya pet phoolna hai?",
        (
            "exacerbating_relieving",
            "abdominal_pain",
        ): "Khane-peene se dard badhta ya kam hota hai?",
        (
            "site",
            "abdominal_pain",
        ): "Pet mein dard kahan zyada hai — upar, neeche, daayein, baayein, ya poora?",
        # --- pain MSK ---
        (
            "mechanism",
            "pain",
        ): (
            "Kya koi chot, accident, girna, twist, ya bhari cheez uthane se yeh shuru hua?"
        ),
        (
            "associations",
            "pain",
        ): (
            "Saath mein pair mein sunn pan ya kamzori, bukhar, ulti, "
            "ya pashaab/control mein dikkat hai?"
        ),
        (
            "exacerbating_relieving",
            "pain",
        ): (
            "Kaunsi harkat se dard badhta hai (baithna, khada hona, jhukna)? "
            "Kis se aaram milta hai?"
        ),
        (
            "radiation",
            "pain",
        ): "Kya dard pair, baaju, ya gardan ki taraf failta hai?",
        # --- chest ---
        (
            "associations",
            "chest_pain_soft",
        ): "Saath mein saans phoolna, pasina, ulti, ya baaju mein failna hai?",
        (
            "radiation",
            "chest_pain_soft",
        ): "Kya dard baaju, gardan, ya peeth ki taraf failta hai?",
    }
    return overrides.get((dim, subtype))


_BASE_PROBE_TEMPLATES: dict[str, str] = {
    "site": "Kahan exactly {problem} feel ho rahi hai?",
    "onset": "Yeh kab shuru hui — aaj, kuch din pehle, ya dheere-dheere?",
    "character": "Kaisa feel hota hai — tees, jalan, dabaav, ya kuch aur?",
    "radiation": "Kya yeh kisi aur jagah failta hai (jaise baaju, peeth, gardan)?",
    "associations": (
        "Saath mein koi aur symptoms hain — kamzori, bukhar, "
        "ulti, khaansi, ya control mein dikkat?"
    ),
    "time_course": "Yeh problem lagatar hai ya aata-jata / waves mein?",
    "exacerbating_relieving": "Kis cheez se problem badhti hai? Kis se aaram milta hai?",
    "severity": "0 se 10 mein, kitna severe hai abhi? (0 = bilkul nahi, 10 = sabse zyada)",
    "pain_now": "Abhi bhi dard / problem ho rahi hai — halka, madhyam, ya tez?",
    "prior_medications": "Is problem ke liye koi dawai le rahe ho / le chuke ho?",
    "prior_consult": "Is problem ke liye pehle kisi doctor se mil chuke ho?",
    "mechanism": (
        "Kya koi chot, accident, girna, twist, ya bhari cheez uthane se yeh shuru hua?"
    ),
    "bleeding_now": "Khoon abhi ruk gaya hai ya abhi bhi aa raha hai?",
    "consciousness": "Girne / chot ke baad behoshi, chakkar, ya yaad nahi aana hua?",
    "blood_thinners": (
        "Koi khoon patla karne wali dawai (aspirin, warfarin, clopidogrel, etc.) lete ho?"
    ),
    "ayush_vaya": "Aapki umar kitni hai? (sirf number batayein, jaise 20)",
    "ayush_prakriti": (
        "Aam dinon mein aapka shareer kaisa rehta hai — "
        "garam/thanda, patla/madhyam/bhari? Short mein batayein."
    ),
    "ayush_vikriti": (
        "Is bimari mein aap usual se kaise alag feel kar rahe ho "
        "(thakaan, garam/thanda, dryness)? Agar farak nahi, 'none' likhein."
    ),
    "ayush_agni": (
        "Abhi bhookh kaisi hai — normal, kam, ya bilkul nahi? "
        "Hazma / gas-acidity bhi short mein batayein."
    ),
    "ayush_bala": (
        "Height aur weight approx batayein (jaise 5.8 ft, 70 kg). "
        "Agar patla/mazboot feel ho to woh bhi."
    ),
    "ayush_manas_vyayam": (
        "Exercise / chalna-phirna kitna kar paate ho "
        "(mild / moderate / zyada)? Stress alag se batayein agar hai."
    ),
}

_BASE_PROBE_TEMPLATES_EN: dict[str, str] = {
    "site": "Where exactly do you feel the {problem}?",
    "onset": "When did this start — today, a few days ago, or gradually?",
    "character": "What does it feel like — sharp, dull, burning, pressure, or something else?",
    "radiation": "Does it spread anywhere else (arm, back, neck)?",
    "associations": (
        "Any other symptoms — weakness, fever, vomiting, cough, or trouble controlling?"
    ),
    "time_course": "Is it constant or does it come and go in waves?",
    "exacerbating_relieving": "What makes it worse? What gives relief?",
    "severity": "On a scale of 0 to 10, how severe is it right now?",
    "pain_now": "Is the pain/problem still happening — mild, moderate, or severe?",
    "prior_medications": "Have you taken any medicine for this problem?",
    "prior_consult": "Have you seen a doctor or clinic for this problem before?",
    "mechanism": "Did an injury, fall, twist, or heavy lifting start this?",
    "bleeding_now": "Is there bleeding right now — yes, no, or stopped?",
    "consciousness": "After the injury, any fainting, dizziness, or memory loss?",
    "blood_thinners": "Do you take blood thinners (aspirin, warfarin, clopidogrel, etc.)?",
    "ayush_vaya": "How old are you? Please give your age as a number (e.g. 25).",
    "ayush_prakriti": (
        "Usually, is your body more hot or cold, and build thin, medium, or heavy?"
    ),
    "ayush_vikriti": (
        "During this illness/injury, do you feel different from usual "
        "(weakness, heat/cold, dryness)? If not, say none."
    ),
    "ayush_agni": "How is your appetite and digestion right now — normal, low, or none?",
    "ayush_bala": "Approximate height and weight (e.g. 5.8 ft, 70 kg)?",
    "ayush_manas_vyayam": (
        "How is your exercise capacity and stress level (mild / moderate / high)?"
    ),
}

_REPROMPT_TEMPLATES: dict[str, str] = {
    "site": "Sirf batayein — problem body par kahan exactly feel ho rahi hai?",
    "onset": "Kab se hai — aaj, kitne din pehle, ya dheere-dheere? Short mein batayein.",
    "character": "Kaisa feel hota hai — sharp, dull, burning, pressure? Ek word mein bhi chalega.",
    "severity": "Sirf 0 se 10 number batayein (jaise 7). Mild/severe word se kaam nahi chalega.",
    "radiation": "Kya dard ya problem kisi aur jagah failti hai? Haan/nahi ya location batayein.",
    "associations": "Saath mein aur koi symptom hai? Agar nahi, 'none' likhein.",
    "time_course": "Lagatar hai ya aata-jata? Short mein batayein.",
    "exacerbating_relieving": "Kis se badhta / kam hota hai? Agar pata nahi, 'none' likhein.",
    "prior_medications": (
        "Is problem ke liye koi dawai li? Naam ya haan/nahi — food request nahi chahiye."
    ),
    "prior_consult": (
        "Doctor/clinic se pehle is problem ke liye consult kiya? "
        "Family se milna alag hai — sirf doctor visit batayein."
    ),
    "mechanism": "Chot, girna, twist, ya heavy lifting — kya hua tha? Short mein batayein.",
    "bleeding_now": "Abhi bleeding ho rahi hai? Haan / nahi / ruk gayi.",
    "consciousness": "Behoshi, chakkar, ya yaad na aana hua? Haan / nahi.",
    "blood_thinners": "Blood thinner dawai lete ho? Haan / nahi ya naam.",
    "ayush_vaya": "Sirf umar number mein batayein (jaise 25).",
    "ayush_prakriti": "Aam dinon body type — garam/thanda, patla/madhyam/bhari? Short mein.",
    "ayush_vikriti": "Is illness mein usual se kya alag feel ho raha hai? Agar nahi, 'none'.",
    "ayush_agni": "Bhookh aur hazma kaisa hai? Clinical short answer — food order nahi.",
    "ayush_bala": "Approx height/weight batayein (jaise 5.6 ft, 65 kg).",
    "ayush_manas_vyayam": "Exercise capacity aur stress — short mein batayein.",
}

_REPROMPT_TEMPLATES_EN: dict[str, str] = {
    "site": "Please tell me exactly where on your body you feel the problem.",
    "onset": "When did it start — today, how many days ago, or gradually? Keep it short.",
    "character": "What does it feel like — sharp, dull, burning, pressure? One word is fine.",
    "severity": "Please give only a number from 0 to 10 (e.g. 7). Mild/severe words won't work.",
    "radiation": "Does the pain spread elsewhere? Yes/no or name the location.",
    "associations": "Any other symptoms with this? If none, say 'none'.",
    "time_course": "Is it constant or does it come and go? Short answer please.",
    "exacerbating_relieving": "What makes it worse or better? If unsure, say 'none'.",
    "prior_medications": (
        "Any medicine taken for this problem? Name it or yes/no — not a food request."
    ),
    "prior_consult": (
        "Did you see a doctor/clinic for this before? "
        "Meeting family is different — only doctor visits please."
    ),
    "mechanism": "Injury, fall, twist, or heavy lifting — what happened? Short answer.",
    "bleeding_now": "Is there bleeding now? Yes / no / stopped.",
    "consciousness": "Any fainting, dizziness, or memory loss? Yes / no.",
    "blood_thinners": "Blood thinner medicines? Yes / no or name.",
    "ayush_vaya": "Please give only your age as a number (e.g. 25).",
    "ayush_prakriti": "Usual body type — hot/cold, thin/medium/heavy? Short answer.",
    "ayush_vikriti": "How do you feel different from usual during this illness? If not, say none.",
    "ayush_agni": "Appetite and digestion — short clinical answer, not a food order.",
    "ayush_bala": "Approx height/weight (e.g. 5.6 ft, 65 kg).",
    "ayush_manas_vyayam": "Exercise capacity and stress — short answer please.",
}


def _problem_label(subtype: ComplaintSubtype, chief: str) -> str:
    low = (chief or "").lower()
    if subtype == "fever" or re.search(r"fever|bukhar", low):
        return "bukhar / problem"
    if subtype == "respiratory" or re.search(r"cough|khaansi|saans", low):
        return "khaansi / saans ki problem"
    if subtype == "gi" or re.search(r"loose|vomit|ulti|pet", low):
        return "pet ki problem"
    if subtype == "headache" or re.search(r"headache|sir", low):
        return "sir dard"
    if subtype in ("limb_pain", "pain", "abdominal_pain", "chest_pain_soft"):
        return "dard / pareshani"
    return "pareshani"


def _problem_label_en(subtype: ComplaintSubtype, chief: str) -> str:
    low = (chief or "").lower()
    if subtype == "fever" or re.search(r"fever", low):
        return "fever"
    if subtype == "respiratory" or re.search(r"cough|breath", low):
        return "breathing/cough problem"
    if subtype == "gi" or re.search(r"loose|vomit|stomach", low):
        return "stomach problem"
    if subtype == "headache" or re.search(r"headache|head", low):
        return "headache"
    if subtype in ("limb_pain", "pain", "abdominal_pain", "chest_pain_soft"):
        return "pain/discomfort"
    return "problem"


def compose_probe_fallback(
    dim: str,
    subtype: ComplaintSubtype,
    chief_complaint: str = "",
    *,
    language: PatientLanguage = "hinglish",
) -> str:
    """Universal probe text: subtype override → base template with problem label."""
    override = probe_question_for(dim, subtype)
    if override and language == "hinglish":
        return override
    templates = _BASE_PROBE_TEMPLATES_EN if language == "english" else _BASE_PROBE_TEMPLATES
    template = templates.get(dim)
    if not template:
        return f"Please tell me about {dim.replace('_', ' ')}."
    if language == "english":
        problem = _problem_label_en(subtype, chief_complaint)
    else:
        problem = _problem_label(subtype, chief_complaint)
    return template.replace("{problem}", problem)


def reprompt_text_for(
    dim: str,
    subtype: ComplaintSubtype,
    *,
    language: PatientLanguage = "hinglish",
) -> str | None:
    """Static reprompt when answer was vague/off-topic — fallback only."""
    if language == "english":
        return _REPROMPT_TEMPLATES_EN.get(dim)
    return _REPROMPT_TEMPLATES.get(dim)


# Backward-compat alias for tests and legacy imports
PROBE_QUESTIONS = _BASE_PROBE_TEMPLATES


def looks_like_new_symptom(text: str) -> bool:
    if not text or not text.strip():
        return False
    blob = _normalize(text)
    return any(re.search(p, blob) for p in _NEW_SYMPTOM_PATTERNS)


def post_close_followup_question(text: str) -> str:
    blob = _normalize(text)
    if re.search(r"\bbukhar\b|\bfever\b", blob):
        return "Bukhar kab se hai, aur kitna feel ho raha hai (halka / zyada)?"
    if re.search(r"\bcough\b|\bkhaansi\b", blob):
        return "Khaansi kab se hai, balgam aa raha hai, aur saans phool rahi hai?"
    if re.search(r"\bpet\b|\bstomach\b|\babdomen\b", blob):
        return (
            "Pet dard kahan zyada hai — upar, neeche, ya poora? "
            "Ulti ya loose motions bhi hain?"
        )
    if re.search(r"\bhand\b|\bhaath\b|\bhaat\b|\barm\b|\bleg\b|\bpair\b", blob):
        return (
            "Yeh haath/pair ka dard kab se hai, aur koi chot ya heavy work ke baad hua?"
        )
    if re.search(r"\bpain\b|\bdard\b", blob):
        return "Yeh naya dard kahan hai, aur 0–10 mein kitna severe hai?"
    return "Is naye symptom ke baare mein thoda aur batayein — kab shuru hua aur abhi kaisa hai?"


def _pathway_to_subtype(pathway: Pathway | None) -> ComplaintSubtype | None:
    if pathway is None:
        return None
    if pathway == "urgent_trauma":
        return "urgent_trauma"
    if pathway == "pain":
        return "pain"
    return "general"


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s']", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text
