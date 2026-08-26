"""Deterministic intake pathway / complaint-subtype classification and probe banks."""

from __future__ import annotations

import re
from typing import Literal

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


def classify_complaint_subtype(
    text: str,
    existing_subtype: ComplaintSubtype | None = None,
    site: str | None = None,
) -> ComplaintSubtype:
    """Chief-complaint aware classification with sticky non-pain banks."""
    blob = _normalize(" ".join(filter(None, [text, site or ""])))

    if any(re.search(p, blob) for p in _URGENT_PATTERNS):
        return "urgent_trauma"
    if existing_subtype == "urgent_trauma":
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


def probe_order_for_subtype(subtype: ComplaintSubtype, site: str | None = None) -> list[str]:
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
        return _core_then_ayush(
            [
                "site",
                "onset",
                "mechanism",
                "character",
                "severity",
                "associations",
                "exacerbating_relieving",
            ]
        )

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
