from __future__ import annotations

import json
import os
import re
import time
from typing import Any

import requests

from app.document_ai.extraction.base import ExtractionEngine
from app.document_ai.extraction.schema import ABDMExtractionResult


class MistralExtractionEngine(ExtractionEngine):
    """
    Mistral extraction engine.

    Flow:

        corrected OCR
            ↓
        Mistral
            ↓
        JSON
            ↓
        normalization
            ↓
        Pydantic validation
            ↓
        ABDMExtractionResult
    """

    provider = "mistral"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:

        self.api_key = (
            api_key
            or os.getenv("MISTRAL_API_KEY")
        )

        if not self.api_key:
            raise RuntimeError(
                "MISTRAL_API_KEY is not configured."
            )

        self.model = (
            model
            or os.getenv(
                "MISTRAL_EXTRACTION_MODEL",
                "ministral-14b-latest",
            )
        )

        self.api_base = (
            os.getenv(
                "MISTRAL_API_BASE",
                "https://api.mistral.ai/v1",
            )
        )

    # =========================================================
    # HTTP HELPER
    # =========================================================

    def _call_chat_api(
        self,
        messages: list[dict[str, str]],
    ) -> dict:
        """Call Mistral chat completions API via HTTP."""

        url = f"{self.api_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0,
        }

        resp = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=120,
        )

        if resp.status_code != 200:
            raise RuntimeError(
                f"Mistral API returned status "
                f"{resp.status_code}: {resp.text}"
            )

        return resp.json()

    # =========================================================
    # EXTRACTION
    # =========================================================

    def extract(
        self,
        ocr_text: str,
        ocr_blocks: list[dict[str, Any]] | None = None,
        *,
        raw_ocr_text: str | None = None,
        corrections: list[dict[str, Any]] | None = None,
    ) -> ABDMExtractionResult:

        if not isinstance(ocr_text, str):
            raise TypeError(
                "ocr_text must be a string."
            )

        if not ocr_text.strip():
            raise ValueError(
                "ocr_text cannot be empty."
            )

        prompt = self._build_prompt(
            ocr_text=ocr_text,
            ocr_blocks=ocr_blocks,
            raw_ocr_text=raw_ocr_text,
            corrections=corrections,
        )

        start = time.perf_counter()

        try:
            response = self._call_chat_api(
                messages=[
                    {
                        "role": "system",
                        "content": self._system_prompt(),
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
            )

        except Exception as exc:

            elapsed = (
                time.perf_counter() - start
            ) * 1000

            raise RuntimeError(
                "Mistral extraction request failed "
                f"after {elapsed:.2f} ms: {exc}"
            ) from exc

        try:
            content = (
                response["choices"][0]
                ["message"]["content"]
            )

        except (KeyError, IndexError, TypeError) as exc:

            raise RuntimeError(
                "Unexpected Mistral response format."
            ) from exc

        if not content:
            raise RuntimeError(
                "Mistral returned an empty response."
            )

        return self._parse_response(
            content,
            corrected_ocr=ocr_text,
            ocr_blocks=ocr_blocks,
        )

    # =========================================================
    # SYSTEM PROMPT
    # =========================================================

    @staticmethod
    def _system_prompt() -> str:

        # NOTE: this is a plain (non-f) string literal. The JSON
        # examples below contain real single braces on purpose; no
        # interpolation happens here, so they need no escaping and
        # cannot raise a formatting error. Keep it non-f-string.
        return """
You are the clinical information extraction
component of a medical Document AI system.

The document has already passed through OCR
and OCR correction.

Your task is ONLY to transform corrected OCR
into structured JSON.

The corrected OCR is the primary source.

STRICT RULES:

1. Never invent information.
2. Never guess missing information.
3. Never invent medication details.
4. Never invent diagnoses.
5. Never invent laboratory values.
6. Never invent dates.
7. Never invent patient information.
8. Never infer diagnoses from symptoms.
9. Never infer medications from abbreviations.
10. Preserve ambiguous information.
11. Record uncertainty instead of guessing.
12. Do not undo accepted OCR corrections.
13. Never infer a medication's route of administration from your
    own medical knowledge of that medication -- only from explicit
    notation in the document (see ROUTE below).
14. Never invent a measurement unit. If the document writes a bare
    number, keep it bare (see MEDICATIONS below).
15. Never expand an abbreviation and never add a parenthetical
    explanation or any other word the document does not contain.
    Use the document's own wording: keep "CBC" as "CBC", not
    "CBC (Complete Blood Count)"; keep "RIS" as "RIS". Added
    explanatory text is not present in the document, will be
    treated as ungrounded, and can cause the entire item to be
    discarded -- so expanding an abbreviation risks LOSING real
    clinical information.
16. Return ONLY JSON.

CLINICAL RELEVANCE:

Only extract information that is BOTH:
- explicitly present in the corrected OCR, AND
- clinically relevant to this specific patient's encounter,
  prescription, or report.

Generic hospital/service boilerplate must NEVER become a
clinical_entity, symptom, diagnosis, procedure, or medication,
even if it appears in the document text. This includes:
- advertisements or promotional text
- service catalogs / rate cards / package menus
- doctor credentials, qualifications, registration numbers
- contact details, phone numbers, emails, websites, addresses
- generic instructions unrelated to this patient
  (e.g. "call our helpline for home visit bookings")

If you are unsure whether a phrase is genuine patient-specific
clinical information or generic boilerplate, prefer to leave it
out and, if useful, note the ambiguity in "uncertainties" rather
than emitting it as a clinical entity.

PATIENT:

Use:

"name": string or null
"age": integer or null
"sex": string or null

Do not return patient scalar fields as objects.

Correct:

{
  "name": "Rahul",
  "age": 29,
  "sex": null
}

Do NOT return:

{
  "name": {
    "description": "Rahul"
  }
}

SYMPTOMS:

Every symptom must be an object:

{
  "description": "fever"
}

CLINICAL ENTITIES:

Every entity must be:

{
  "description": "oral fluids",
  "uncertainty": null
}

Clinical entities are for genuine patient-specific clinical
information that does not fit elsewhere (e.g. an instruction like
"oral fluids", a vital sign, a clinical observation). They are NOT
a catch-all for hospital services or boilerplate (see CLINICAL
RELEVANCE above).

If the corrected OCR text for a clinical entity is itself garbled,
run-on, or otherwise unclear -- for example it mixes unrelated
tokens, stray abbreviations, or prescription-instruction words
(like "sos") into what looks like a note -- do NOT silently
interpret or clean it up into a confident diagnosis or symptom.
Preserve the text as written and set "uncertainty" to a short
explanation that its meaning could not be confidently determined.
Never turn an unclear note into a specific diagnosis or symptom
you infer from a fragment of it (e.g. do not turn a garbled note
that happens to contain "flu" into a diagnosis or symptom "flu").

MEDICATIONS:

Use:

name
dose
frequency
route
duration
indication

Scalar medication fields should preferably be strings.

Prescription notation prefixes such as "T.", "Tab.", "Tablet",
"Syp.", "Syr.", "Cap.", "Caps.", "Inj.", "Injection", "Drops",
"Cream", "Oint." are presentation notation, not part of the drug
identity. You do not need to strip them yourself -- downstream
normalization handles that -- but never let them cause you to
alter, guess, or "correct" the underlying drug name.

Report each piece of information ONCE. Never repeat the same
strength in both "name" and "dose". If you put the strength in
"dose", do not also leave it inside "name", and vice versa:

- "T. Azee 500 mg" -> name "Azee", dose "500 mg"
- never dose "500 mg 500 mg"

A number in a medication name that has NO unit next to it is part
of how the product is written, not a measured dose. Keep it in the
name and leave "dose" null. Only report a dose when the document
itself shows a unit:

- "T. Dolo 650"    -> name "Dolo 650", dose null
- "T. Dolo 650 mg" -> name "Dolo",     dose "650 mg"

Never add a unit the document does not show (do not turn "650"
into "650 mg").

If a medication name is unclear or ambiguous in the corrected OCR
(for example "T. Ian 40 mg" where "Ian" does not clearly match a
known drug), preserve the OCR text exactly as the name. Do NOT
substitute it with a different, more familiar drug name. Record
the ambiguity in "uncertainties" instead of guessing.

The same applies to any numeric value whose role is unclear (for
example a trailing number after a dose that could be a quantity,
a frequency, or something else) -- preserve it as written rather
than guessing its meaning.

"SOS" (or "PRN") in a prescription is an instruction meaning "as
needed" -- it belongs in "frequency", never in "dose". If both
"SOS"/"PRN" and a separate "as needed"-style phrase appear for the
same medication, they mean the same thing -- report a single
frequency value, do not repeat the instruction twice.

A phrase like "x 7 days" or "for 7 days" describes duration, not
frequency -- put it in "duration", not "frequency", unless the
document also gives a genuine separate frequency (e.g. "BD x 7
days" -> frequency "BD", duration "7 days"). Dose forms such as
"BD", "OD", "TDS", "QID", "once daily", "SOS" are frequencies.
Never invent a frequency that the document does not state.

ROUTE:

Only set "route" when the document explicitly states it for that
specific medication, or the prescription notation for that
medication unambiguously establishes it. For example:

- "oral", "PO", "by mouth" -> supports an oral route
- "Inj.", "injection", "IV", "IM" -> supports an injectable route

A dosage-form marker like "Syp." (syrup) or "Tab." (tablet) tells
you the FORMULATION, not the route -- do not turn a formulation
marker into a route on your own.

Do NOT reason from your own knowledge of a drug (e.g. "Azithromycin
is usually taken orally, therefore route = oral"). If the document
does not explicitly support a route for a given medication line,
leave "route" null for that medication, even if you recognize the
drug and know how it is typically administered.

AYUSH:

Use:

ahara_vihara
prakriti
vikriti

Only populate these if explicitly present.

Never infer prakriti or vikriti.

UNCERTAINTIES:

Use:

{
  "description": "...",
  "source_blocks": []
}

Return ONLY valid JSON.
""".strip()

    # =========================================================
    # USER PROMPT
    # =========================================================
    #
    # PROMPT SAFETY
    #
    # The expected output shape is declared as a real Python
    # structure and serialized with json.dumps(). It is therefore
    # impossible for the example JSON to be interpreted as f-string
    # replacement fields, and no brace escaping is required. Never
    # inline raw JSON braces into the f-string below.
    # =========================================================

    _OUTPUT_TEMPLATE: dict[str, Any] = {
        "clinical_data": {
            "patient": {
                "name": None,
                "age": None,
                "sex": None,
            },
            "encounter": {
                "department": None,
                "visit_type": None,
                "collected_on": None,
                "reported_on": None,
            },
            "report": {
                "type": None,
                "panel": None,
                "status": None,
            },
            "clinical_results": [],
            "medications": [],
            "diagnoses": [],
            "symptoms": [],
            "procedures": [],
            "clinical_entities": [],
            "ayush_parameters": {
                "ahara_vihara": None,
                "prakriti": None,
                "vikriti": None,
            },
        },
        "metadata": {
            "extraction_confidence": 0.0,
            "requires_manual_review": False,
            "uncertainties": [],
        },
    }

    @classmethod
    def _build_prompt(
        cls,
        ocr_text: str,
        ocr_blocks: list[dict[str, Any]] | None,
        raw_ocr_text: str | None = None,
        corrections: list[dict[str, Any]] | None = None,
    ) -> str:

        blocks: list[dict[str, Any]] = []

        if ocr_blocks:

            for index, block in enumerate(ocr_blocks):

                if not isinstance(block, dict):
                    continue

                blocks.append(
                    {
                        "index": index,
                        "page": block.get("page"),
                        "content": block.get("content"),
                        "confidence": block.get(
                            "confidence"
                        ),
                    }
                )

        correction_history: list[
            dict[str, Any]
        ] = []

        if corrections:

            for correction in corrections:

                if not isinstance(
                    correction,
                    dict,
                ):
                    continue

                raw_value = correction.get(
                    "raw_text"
                )

                corrected_value = correction.get(
                    "corrected_text"
                )

                if not raw_value or not corrected_value:
                    continue

                correction_history.append(
                    {
                        "raw_ocr": raw_value,
                        "corrected_ocr": corrected_value,
                        "accepted": correction.get(
                            "accepted",
                            True,
                        ),
                        "reason": correction.get(
                            "reason"
                        ),
                    }
                )

        blocks_json = json.dumps(
            blocks,
            indent=2,
            ensure_ascii=False,
        )

        corrections_json = json.dumps(
            correction_history,
            indent=2,
            ensure_ascii=False,
        )

        output_template_json = json.dumps(
            cls._OUTPUT_TEMPLATE,
            indent=2,
            ensure_ascii=False,
        )

        # Only pre-serialized variables are interpolated below.
        # There are deliberately no literal braces in this
        # f-string, so no escaping is needed and it cannot raise.
        return f"""
Extract structured clinical data from the
CORRECTED OCR below.

The corrected OCR is the source of truth.

Do not perform OCR correction again.

Do not invent missing information.

==================================================
CORRECTED OCR
==================================================

{ocr_text}

==================================================
ORIGINAL OCR
==================================================

{raw_ocr_text or ""}

==================================================
OCR BLOCKS
==================================================

{blocks_json}

==================================================
CORRECTION HISTORY
==================================================

{corrections_json}

==================================================
OUTPUT
==================================================

Return ONLY:

{output_template_json}
""".strip()

    # =========================================================
    # JSON EXTRACTION
    # =========================================================

    @staticmethod
    def _strip_code_fences(
        content: str,
    ) -> str:

        content = content.strip()

        if not content.startswith("```"):
            return content

        lines = content.splitlines()

        if lines:
            lines = lines[1:]

        if (
            lines
            and lines[-1].strip() == "```"
        ):
            lines = lines[:-1]

        return "\n".join(lines).strip()

    @staticmethod
    def _extract_json_object(
        content: str,
    ) -> str:

        start = content.find("{")

        if start < 0:
            raise ValueError(
                "Mistral response does not contain JSON."
            )

        depth = 0
        in_string = False
        escaped = False

        for index in range(
            start,
            len(content),
        ):

            char = content[index]

            if escaped:
                escaped = False
                continue

            if (
                char == "\\"
                and in_string
            ):
                escaped = True
                continue

            if char == '"':
                in_string = not in_string
                continue

            if in_string:
                continue

            if char == "{":
                depth += 1

            elif char == "}":

                depth -= 1

                if depth == 0:
                    return content[
                        start:index + 1
                    ]

        raise ValueError(
            "Mistral returned incomplete JSON."
        )

    # =========================================================
    # GENERIC SCALAR NORMALIZATION
    # =========================================================

    @classmethod
    def _scalar(
        cls,
        value: Any,
    ) -> Any:
        """
        Convert LLM rich scalar representations into
        simple canonical values.

        Examples:

        {"description": "Rahul"}
            -> "Rahul"

        {"description": "29 months"}
            -> "29 months"

        {"value": "F"}
            -> "F"

        500
            -> "500"

        {"days": 7}
            -> "7 days"
        """

        if value is None:
            return None

        if isinstance(
            value,
            (str, int, float, bool),
        ):
            return value

        if isinstance(
            value,
            list,
        ):

            parts = []

            for item in value:

                converted = cls._scalar(
                    item
                )

                if converted is not None:

                    parts.append(
                        str(converted)
                    )

            return (
                "; ".join(parts)
                if parts
                else None
            )

        if isinstance(
            value,
            dict,
        ):

            # Most common LLM wrapper.
            for key in (
                "description",
                "value",
                "text",
                "name",
            ):

                if key in value:

                    inner = value.get(
                        key
                    )

                    if inner is not None:

                        return cls._scalar(
                            inner
                        )

            # Duration-style structure.
            if "days" in value:

                parts = []

                days = value.get(
                    "days"
                )

                if days is not None:

                    parts.append(
                        f"{days} days"
                    )

                for key, item in value.items():

                    if key == "days":
                        continue

                    if item is None:
                        continue

                    parts.append(
                        f"{key}: {item}"
                    )

                return (
                    "; ".join(parts)
                    if parts
                    else None
                )

            # Generic dictionary.
            parts = []

            for key, item in value.items():

                if item is None:
                    continue

                converted = cls._scalar(
                    item
                )

                if converted is not None:

                    parts.append(
                        f"{key}: {converted}"
                    )

            return (
                "; ".join(parts)
                if parts
                else None
            )

        return str(value)

    # =========================================================
    # PATIENT NORMALIZATION
    # =========================================================

    @classmethod
    def _normalize_patient(
        cls,
        patient: Any,
    ) -> dict[str, Any]:

        if not isinstance(
            patient,
            dict,
        ):
            return {
                "name": None,
                "age": None,
                "sex": None,
            }

        name = patient.get(
            "name"
        )

        age = patient.get(
            "age"
        )

        sex = patient.get(
            "sex"
        )

        # NAME
        name = cls._scalar(
            name
        )

        if name is not None:
            name = str(name).strip()

        # AGE
        age_value = cls._scalar(
            age
        )

        normalized_age = None

        if age_value is not None:

            if isinstance(
                age_value,
                int,
            ):
                normalized_age = age_value

            elif isinstance(
                age_value,
                float,
            ):

                normalized_age = int(
                    age_value
                )

            elif isinstance(
                age_value,
                str,
            ):

                text = age_value.strip()

                # Extract only when the LLM explicitly
                # supplied a numeric age representation.
                match = re.fullmatch(
                    r"(\d+)",
                    text,
                )

                if match:

                    normalized_age = int(
                        match.group(1)
                    )

                else:

                    # Example:
                    # "29 months"
                    #
                    # Do NOT silently convert this to
                    # 29 years. It is ambiguous and should
                    # remain null for the canonical integer
                    # field.
                    normalized_age = None

        # SEX
        sex = cls._scalar(
            sex
        )

        if sex is not None:
            sex = str(sex).strip()

        return {
            "name": name,
            "age": normalized_age,
            "sex": sex,
        }

    # =========================================================
    # MEDICATION FIELD PARSING (deterministic, non-LLM)
    # =========================================================
    #
    # The extraction LLM is not reliable at splitting a raw
    # prescription line into (name, dose, frequency, duration).
    # Rather than trust the model's own field boundaries, this
    # step re-derives them deterministically from whatever text
    # the model put in "name"/"dose"/"frequency", using only
    # presentation-notation rules that are true regardless of
    # which drug is involved. It NEVER changes what drug a name
    # refers to -- it only relocates prefix/strength/duration/
    # instruction *tokens* that were misplaced, and never emits
    # the same value twice.
    #
    # Rules implemented (see PROBLEMs 1-6 in the design brief):
    #
    #   1. Strip a leading presentation prefix (T./Tab./Syp./...)
    #      from the medication name. Only an injection prefix
    #      (Inj./Injection) establishes a route, because that is
    #      notation about administration; a formulation marker
    #      (Syp./Tab./Cap.) never does.
    #
    #   2. If the name contains an explicit-unit strength (e.g.
    #      "40 mg", "500 mg") preceded by a brand token, split the
    #      brand into "name" and move the strength (plus any
    #      trailing remainder such as a stray quantity) into
    #      "dose". Merging is duplicate-aware: a strength the dose
    #      already states is NOT appended a second time, so
    #      "500 mg" + "500 mg" stays "500 mg" and never becomes
    #      "500 mg 500 mg". "40mg" and "40 mg" count as the same
    #      value. Genuinely different information (e.g. a separate
    #      "100 tablets") is still preserved.
    #
    #   3. A BARE number (no unit) at the end of a name is part of
    #      how the product is written, not a measured dose:
    #        "Dolo 650"                 -> name "Dolo 650", dose null
    #        "Dolo 650" + dose "650"    -> name "Dolo 650", dose null
    #        "Dolo 650" + dose "650 mg" -> name "Dolo",     dose "650 mg"
    #      A unit is never invented, and the number is only split
    #      off the name when the document supplied the unit.
    #
    #   4. "x 7 days" / "for 7 days" style text found in frequency
    #      or dose is duration, not frequency/dose -- move it to
    #      "duration" (days/weeks/months/hours are all handled).
    #      Any other token(s) that remain (e.g. a genuine "BD")
    #      stay in their original field.
    #
    #   5. "SOS" (or "PRN"), and/or a synonymous "as needed"-style
    #      phrase, is an as-needed instruction, i.e. a frequency,
    #      never a dose -- relocate it accordingly. When both an
    #      explicit SOS/PRN token and redundant "as needed"-style
    #      wording occur together, they are collapsed into a
    #      single canonical "sos" value rather than being kept
    #      side by side (e.g. "as needed () sos" -> "sos").
    #
    # This function is deliberately conservative: it only ever
    # relocates text it can identify by an explicit, documented
    # pattern. It never invents, drops, or reinterprets content,
    # and it never guesses a missing unit.
    # =========================================================

    _MED_PREFIX_RE = re.compile(
        r"^(?P<token>tab(?:let)?s?|t|syp|syr|syrup|susp(?:ension)?|"
        r"cap(?:s|sule)?s?|inj(?:ection)?|drops?|cream|gel|lotion|"
        r"oint(?:ment)?|powder|sachet)"
        r"(?:\s*\.\s*|\s+)",
        re.IGNORECASE,
    )

    # Explicit dose/strength units ONLY.
    #
    # Deliberately restricted to mass / volume / activity units:
    # the presence of one of these is what makes it safe to split a
    # number away from a drug name. Dosage-form COUNTS ("tab",
    # "cap", "drop", "puff") are intentionally absent, so a written
    # product strength such as "Dolo 650 tab" keeps "650" attached
    # to the name instead of being guessed apart (see rule 3).
    _DOSE_UNIT_PATTERN = (
        r"(?:"
        r"mcg\s*/\s*\d*\s*ml|mg\s*/\s*\d*\s*ml|iu\s*/\s*\d*\s*ml|"
        r"mg\s*/\s*kg|mcg\s*/\s*kg|"
        r"mcg|µg|ug|mg|mmol|meq|gm|kg|g|ml|cl|dl|cc|iu|units?|"
        r"tsp|tbsp|l|%"
        r")"
    )

    # A number immediately followed by an explicit unit.
    # The trailing lookahead (rather than \b) is required so that
    # unit forms ending in a non-word character, such as "%",
    # still match.
    _MED_STRENGTH_RE = re.compile(
        r"(?P<num>\d+(?:[.,]\d+)?)\s*"
        r"(?P<unit>" + _DOSE_UNIT_PATTERN + r")"
        r"(?![a-z0-9])",
        re.IGNORECASE,
    )

    # Tokenizer used for duplicate-aware dose merging. A dose is
    # compared as a set of segments: a number+unit strength, a bare
    # number, or a word. Nothing is ever rebuilt from these
    # segments -- they are only used to decide whether an addition
    # would restate something the dose already says.
    _DOSE_SEGMENT_RE = re.compile(
        r"(?P<num>\d+(?:[.,]\d+)?)\s*"
        r"(?P<unit>" + _DOSE_UNIT_PATTERN + r")"
        r"(?![a-z0-9])"
        r"|(?P<bare>\d+(?:[.,]\d+)?)"
        r"|(?P<word>[a-z%µ]+)",
        re.IGNORECASE,
    )

    _BARE_NUMBER_RE = re.compile(
        r"^\d+(?:[.,]\d+)?$"
    )

    # A bare trailing number in a medication name, e.g. the "650"
    # of "Dolo 650". Leading whitespace is required so that a
    # brand token like "B12" is never split.
    _NAME_BARE_SUFFIX_RE = re.compile(
        r"\s(?P<num>\d+(?:[.,]\d+)?)\s*$"
    )

    _MED_DURATION_RE = re.compile(
        r"(?:\bx\s*|\bfor\s+)?"
        r"(?P<num>\d+)\s*"
        r"(?P<unit>days?|weeks?|wks?|months?|mths?|hours?|hrs?)\b",
        re.IGNORECASE,
    )

    _DURATION_UNIT_CANONICAL: dict[str, str] = {
        "day": "day",
        "days": "day",
        "week": "week",
        "weeks": "week",
        "wk": "week",
        "wks": "week",
        "month": "month",
        "months": "month",
        "mth": "month",
        "mths": "month",
        "hour": "hour",
        "hours": "hour",
        "hr": "hour",
        "hrs": "hour",
    }

    # Connector words that introduce an indication in prescription
    # notation ("sos FOR fever / pain", "prn IN CASE OF vomiting").
    # Deliberately excludes "to", which would corrupt a genuine
    # phrase such as "to control pain" -> "control pain".
    _MED_INDICATION_LEAD_RE = re.compile(
        r"^(?:for\b|f\s*/|in\s+case\s+of\b)\s*",
        re.IGNORECASE,
    )

    # A parenthesised group containing NOTHING but a number, e.g. the
    # "(120)" of "Inj Xgeva - alt # (120)" or the "(4)" of
    # "T. Dexa (4)". This is prescription notation for a quantity or
    # strength written apart from the drug name -- it is never part of
    # a dosing schedule. The "nothing but a number" requirement keeps
    # genuinely different parentheticals (e.g. "(max 6)", "(2 tabs)",
    # "(after food)") from being touched.
    _PAREN_BARE_NUMBER_RE = re.compile(
        r"\(\s*(?P<num>\d+(?:[.,]\d+)?)\s*\)"
    )

    _MED_SOS_RE = re.compile(
        r"\b(sos|prn)\b",
        re.IGNORECASE,
    )

    _MED_AS_NEEDED_RE = re.compile(
        r"\bas[\s-]*needed\b",
        re.IGNORECASE,
    )

    # Vocabulary that makes a value a genuine FREQUENCY. Anything the
    # model puts in "frequency" that contains none of these words is
    # not a dosing schedule, and is relocated or reported rather than
    # asserted as one -- extraction LLMs routinely spill a strength
    # ("1 tsp") or a stray quantity ("100") into this field.
    _FREQUENCY_VOCAB_RE = re.compile(
        r"""
        \b(
            od|bd|bid|tds|tid|qid|qds|qod|hs|nocte|mane|stat|
            sos|prn|qh|qam|qpm|ac|pc|
            once|twice|thrice|times|
            daily|day|days|week|weekly|weeks|month|monthly|months|
            hourly|hour|hours|
            alt|alternate|alternating|every|other|
            morning|noon|afternoon|evening|night|bedtime|
            needed|required|continuous|infusion
        )\b |
        \bq\s*\d+\s*h\b |
        \b\d+\s*-\s*\d+\s*-\s*\d+\b |
        \#
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    # Explicit route/administration notation only. Anything else
    # (including the LLM's own free-text medical inference) is not
    # trusted as a route -- see FINAL ISSUE #4. Dosage-form markers
    # such as "Syp"/"Tab"/"Cap" describe the FORMULATION, not the
    # route, and are deliberately mapped to None here.
    _ROUTE_CANONICAL_MAP: dict[str, str | None] = {
        "oral": "oral",
        "po": "oral",
        "p o": "oral",
        "by mouth": "oral",
        "per oral": "oral",
        "iv": "IV",
        "i v": "IV",
        "intravenous": "IV",
        "im": "IM",
        "i m": "IM",
        "intramuscular": "IM",
        "sc": "SC",
        "subcut": "SC",
        "subcutaneous": "SC",
        "sublingual": "sublingual",
        "topical": "topical",
        "inj": "injection",
        "injection": "injection",
        "pr": "per rectal",
        "per rectal": "per rectal",
        # Formulation markers, not routes.
        "syp": None,
        "syrup": None,
        "tab": None,
        "tablet": None,
        "cap": None,
        "caps": None,
        "capsule": None,
    }

    # Deterministic OCR-noise signals used to flag a clinical entity
    # as ambiguous rather than letting it be asserted as certain.
    # These are intentionally narrow, high-signal patterns:
    #   - a word with irregular internal capitalization (e.g. "opD"),
    #     a common OCR artifact
    #   - a stray single-letter abbreviation followed by a period and
    #     more lowercase text (e.g. "c. reports")
    #   - a prescription-instruction token ("sos"/"prn") appearing
    #     inside what is supposed to be a clinical note, not a
    #     medication line
    _AMBIGUOUS_ENTITY_SIGNS_RE = re.compile(
        r"""
        \b[a-z]{2,}[A-Z]\b |
        \b[a-z]\.\s*[a-z] |
        \b(sos|prn)\b
        """,
        re.VERBOSE,
    )

    @classmethod
    def _normalize_route(
        cls,
        value: Any,
    ) -> str | None:
        """
        Only accept route values that correspond to explicit route
        notation (see _ROUTE_CANONICAL_MAP). Anything else is
        dropped rather than kept, so free-text medical inference by
        the extraction LLM can never surface as a "route" -- see
        FINAL ISSUE #4.
        """

        text = cls._string_value(
            value
        )

        if not text:
            return None

        key = re.sub(
            r"[.\s]+",
            " ",
            text.strip().lower(),
        ).strip()

        if key in cls._ROUTE_CANONICAL_MAP:
            return cls._ROUTE_CANONICAL_MAP[key]

        return None

    @classmethod
    def _detect_ambiguous_entity_uncertainty(
        cls,
        description: str,
    ) -> str | None:
        """
        Deterministically flag a clinical_entities description that
        shows signs of OCR noise/garbling as ambiguous, instead of
        trusting the LLM's own (often absent) uncertainty field.

        This never rewrites, reinterprets, or shortens the
        description -- it only attaches an uncertainty note when the
        text itself looks unreliable. See FINAL ISSUE #2.
        """

        if not description:
            return None

        if cls._AMBIGUOUS_ENTITY_SIGNS_RE.search(
            description
        ):

            return (
                "Ambiguous OCR-derived clinical note; meaning "
                "could not be confidently determined."
            )

        return None

    # ---------------------------------------------------------
    # DOSE VALUE HELPERS
    # ---------------------------------------------------------

    @staticmethod
    def _blank_to_none(
        value: Any,
    ) -> Any:
        """Collapse empty/whitespace-only text to None."""

        if value is None:
            return None

        text = str(value).strip()

        return text or None

    @staticmethod
    def _normalize_number(
        value: Any,
    ) -> str:
        """
        Canonical comparison form for a numeric token, so that
        "40" / "40.0" / "40,0" compare equal while a thousands
        separator ("60,000") is not mistaken for a decimal.
        """

        text = str(value).strip()

        if re.fullmatch(
            r"\d{1,3}(?:,\d{3})+",
            text,
        ):
            text = text.replace(",", "")

        else:
            text = text.replace(",", ".")

        try:
            return f"{float(text):g}"

        except ValueError:
            return text.lower()

    @classmethod
    def _canonical_strength(
        cls,
        match: re.Match[str],
    ) -> str:
        """
        Render a matched strength with exactly one space between the
        number and an alphabetic unit ("500mg" -> "500 mg"), and no
        space before a symbolic unit ("0.1 %" -> "0.1%"), preserving
        the unit's original casing. This normalizes spacing only; it
        never adds, removes, or converts a unit.
        """

        unit = re.sub(
            r"\s*/\s*",
            "/",
            match.group("unit").strip(),
        )

        separator = (
            " "
            if unit[:1].isalpha()
            else ""
        )

        return f"{match.group('num')}{separator}{unit}"

    @classmethod
    def _dose_segment_keys(
        cls,
        value: Any,
    ) -> set[str]:
        """
        Comparison keys for every segment of a dose string.

        A number+unit segment registers BOTH "<num> <unit>" and the
        bare "<num>", so a unit-less restatement of the same
        quantity is recognized as a duplicate rather than appended
        (e.g. dose "100 mg" already covers a stray "100").
        """

        keys: set[str] = set()

        if not value:
            return keys

        for match in cls._DOSE_SEGMENT_RE.finditer(
            str(value)
        ):

            if match.group("num") is not None:

                number = cls._normalize_number(
                    match.group("num")
                )

                unit = re.sub(
                    r"\s*/\s*",
                    "/",
                    match.group("unit").strip().lower(),
                )

                keys.add(f"{number} {unit}")
                keys.add(number)

            elif match.group("bare") is not None:

                keys.add(
                    cls._normalize_number(
                        match.group("bare")
                    )
                )

            elif match.group("word"):

                keys.add(
                    match.group("word").lower()
                )

        return keys

    @classmethod
    def _dose_is_bare_number_text(
        cls,
        value: Any,
    ) -> bool:
        """True when the whole value is a number with no unit."""

        if value is None:
            return False

        return bool(
            cls._BARE_NUMBER_RE.fullmatch(
                str(value).strip()
            )
        )

    @classmethod
    def _dose_states_number_with_unit(
        cls,
        dose: Any,
        number: Any,
    ) -> bool:
        """
        True when `dose` already expresses `number` together with an
        explicit unit -- i.e. the document supplied the unit, so the
        number may safely be split off the medication name.
        """

        if not dose:
            return False

        target = cls._normalize_number(
            number
        )

        for match in cls._MED_STRENGTH_RE.finditer(
            str(dose)
        ):

            if cls._normalize_number(
                match.group("num")
            ) == target:
                return True

        return False

    @classmethod
    def _dose_is_only_number(
        cls,
        dose: Any,
        number: Any,
    ) -> bool:
        """
        True when `dose` is nothing but the same bare number that
        already appears in the medication name. Such a dose adds no
        information and would be a unit-less duplicate.
        """

        if not cls._dose_is_bare_number_text(
            dose
        ):
            return False

        return (
            cls._normalize_number(dose)
            == cls._normalize_number(number)
        )

    @classmethod
    def _merge_dose_value(
        cls,
        existing: Any,
        addition: Any,
    ) -> str | None:
        """
        Combine a dose value with an additional dose fragment
        WITHOUT restating information that is already present.

        Behaviour:

            "500 mg" + "500 mg"      -> "500 mg"
            "500 mg" + "500mg"       -> "500 mg"    (same value)
            "500 mg" + "100"         -> "500 mg 100"
            "500 mg" + "100 tablets" -> "500 mg 100 tablets"
            "650"    + "650 mg"      -> "650 mg"    (unit is better)
            None     + "500 mg"      -> "500 mg"

        The existing text is never rewritten -- an addition is
        either dropped as redundant, or appended verbatim -- so no
        source formatting is ever mangled.
        """

        addition_text = (
            str(addition).strip(" ,;-")
            if addition is not None
            else ""
        )

        existing_text = (
            str(existing).strip()
            if existing is not None
            else ""
        )

        if not addition_text:
            return existing_text or None

        if not existing_text:
            return addition_text

        addition_keys = cls._dose_segment_keys(
            addition_text
        )

        if not addition_keys:
            return existing_text

        # A bare-number dose is superseded by the same quantity
        # stated with an explicit unit. This is not an invented
        # unit: the unit comes from the document.
        if cls._dose_is_bare_number_text(
            existing_text
        ):

            if cls._normalize_number(
                existing_text
            ) in addition_keys:
                return addition_text

        # Nothing new to say.
        if addition_keys <= cls._dose_segment_keys(
            existing_text
        ):
            return existing_text

        return f"{existing_text} {addition_text}"

    @classmethod
    def _dedupe_repeated_strengths(
        cls,
        value: Any,
    ) -> str | None:
        """
        Collapse a strength that is restated inside a SINGLE dose
        value, e.g. a model that emits "500 mg 500 mg" in one field.

        _merge_dose_value prevents this pipeline from ever creating
        such a value, but the extraction LLM can also produce one
        directly, so the same rule is enforced on the final text.

        Only exact repeats of a number+unit strength are removed
        ("40 mg" and "40mg" count as the same strength). Words and
        bare numbers are never touched, so distinct information such
        as "100 tablets 500 mg" survives intact.
        """

        if not value:
            return value

        text = str(value)

        seen: set[str] = set()

        pieces: list[str] = []

        cursor = 0

        removed = False

        for match in cls._MED_STRENGTH_RE.finditer(
            text
        ):

            unit = re.sub(
                r"\s*/\s*",
                "/",
                match.group("unit").strip().lower(),
            )

            key = (
                f"{cls._normalize_number(match.group('num'))}"
                f" {unit}"
            )

            if key in seen:

                pieces.append(
                    text[cursor:match.start()]
                )

                cursor = match.end()

                removed = True

            else:
                seen.add(key)

        if not removed:
            return text

        pieces.append(
            text[cursor:]
        )

        collapsed = re.sub(
            r"\s+",
            " ",
            "".join(pieces),
        )

        return collapsed.strip(" ,;/-") or None

    @classmethod
    def _canonical_duration(
        cls,
        match: re.Match[str],
    ) -> str:
        """
        Render a matched duration as "<number> <unit>", e.g.
        "x 7 days" -> "7 days", "for 2 wks" -> "2 weeks".
        """

        number = match.group("num")

        unit = match.group("unit").lower()

        unit = cls._DURATION_UNIT_CANONICAL.get(
            unit,
            unit,
        )

        try:
            plural = float(number) != 1.0

        except ValueError:
            plural = True

        return (
            f"{number} {unit}s"
            if plural
            else f"{number} {unit}"
        )

    @classmethod
    def _strip_as_needed_tokens(
        cls,
        text: str,
    ) -> str:
        """
        Remove SOS/PRN/"as needed" instruction tokens (and the
        empty-parenthesis noise their removal can leave behind),
        returning whatever unrelated text remains.
        """

        remaining = cls._MED_SOS_RE.sub(
            "",
            text,
        )

        remaining = cls._MED_AS_NEEDED_RE.sub(
            "",
            remaining,
        )

        remaining = re.sub(
            r"\(\s*\)",
            "",
            remaining,
        )

        remaining = re.sub(
            r"\s+",
            " ",
            remaining,
        )

        return remaining.strip(" ,.-/")

    @classmethod
    def _parse_medication_fields(
        cls,
        medication: dict[str, Any],
        notes: list[str] | None = None,
    ) -> dict[str, Any]:

        name = (
            medication.get("name") or ""
        ).strip()

        dose = cls._blank_to_none(
            medication.get("dose")
        )

        frequency = cls._blank_to_none(
            medication.get("frequency")
        )

        duration = cls._blank_to_none(
            medication.get("duration")
        )

        route = medication.get("route")

        indication = cls._blank_to_none(
            medication.get("indication")
        )

        # An indication is a noun phrase ("fever / pain"). The
        # leading connector in prescription notation ("sos FOR fever
        # / pain") belongs to the sentence, not to the indication, so
        # it is stripped. Nothing is added and no word is
        # reinterpreted -- only the connector is removed.
        if indication:

            stripped_indication = (
                cls._MED_INDICATION_LEAD_RE.sub(
                    "",
                    str(indication),
                    count=1,
                ).strip()
            )

            indication = (
                cls._blank_to_none(stripped_indication)
                or indication
            )

        # ---- 1. Strip presentation prefix from the name --------
        prefix_match = cls._MED_PREFIX_RE.match(
            name
        )

        if prefix_match:

            name = name[prefix_match.end():].strip()

            # Only administration notation establishes a route.
            # A formulation marker (Syp./Tab./Cap.) never does.
            prefix_token = (
                prefix_match.group("token") or ""
            ).lower()

            if (
                not route
                and prefix_token.startswith("inj")
            ):
                route = "injection"

        # ---- 2. Split an explicit-unit strength out of the name
        if name:

            strength_match = (
                cls._MED_STRENGTH_RE.search(name)
            )

            if strength_match:

                brand = name[
                    :strength_match.start()
                ].strip(" ,;-")

                remainder = name[
                    strength_match.end():
                ].strip(" ,;-")

                # Only split when a brand token remains. A bare
                # "40 mg" with nothing before it is not a usable
                # split point.
                if brand:

                    name = brand

                    # Duplicate-aware: a strength the dose already
                    # states is not appended a second time, which
                    # is what produced "500 mg 500 mg".
                    dose = cls._merge_dose_value(
                        dose,
                        cls._canonical_strength(
                            strength_match
                        ),
                    )

                    # Any trailing text after the strength (e.g. a
                    # stray quantity) is merged separately so that
                    # genuinely new information survives without
                    # dragging the duplicate strength along.
                    if remainder:

                        dose = cls._merge_dose_value(
                            dose,
                            remainder,
                        )

        # ---- 3. Bare numeric suffix in the name ----------------
        #
        # A number with no unit is part of how the product is
        # written ("Dolo 650"), not a measured dose. It is split
        # off ONLY when the dose supplies the unit, and a unit is
        # never invented.
        suffix_match = (
            cls._NAME_BARE_SUFFIX_RE.search(name)
            if name
            else None
        )

        if suffix_match:

            suffix_number = suffix_match.group("num")

            if cls._dose_states_number_with_unit(
                dose,
                suffix_number,
            ):

                # "Dolo 650" + dose "650 mg" -> name "Dolo"
                trimmed = name[
                    :suffix_match.start()
                ].strip(" ,;-")

                if trimmed:
                    name = trimmed

            elif cls._dose_is_only_number(
                dose,
                suffix_number,
            ):

                # "Dolo 650" + dose "650" -> dose null.
                # The number stays in the name; no unit is guessed.
                dose = None

        # ---- 4. Duration text misplaced in frequency/dose ------
        for field_name in ("frequency", "dose"):

            value = (
                frequency
                if field_name == "frequency"
                else dose
            )

            if not value:
                continue

            duration_match = (
                cls._MED_DURATION_RE.search(
                    str(value)
                )
            )

            if not duration_match:
                continue

            if not duration:
                duration = cls._canonical_duration(
                    duration_match
                )

            remaining = (
                str(value)[:duration_match.start()]
                + str(value)[duration_match.end():]
            ).strip(" .,/xX-")

            if field_name == "frequency":
                frequency = remaining or None
            else:
                dose = remaining or None

        # ---- 5. Frequency sanity check --------------------------
        #
        # At this point any duration text has already been moved out
        # of "frequency". Whatever remains must actually look like a
        # dosing schedule. Extraction LLMs frequently misfile other
        # content here, so:
        #
        #   * contains frequency vocabulary  -> genuine, keep it
        #   * an explicit-unit strength      -> it is a DOSE, move it
        #     ("1 tsp" wrongly filed as a frequency)
        #   * a bare number with no unit     -> role is unknowable;
        #     never assert it as a frequency OR invent a unit for it.
        #     It is removed from "frequency" and reported as an
        #     uncertainty so the information is surfaced, not
        #     silently deleted ("100" from "Azee 500 mg 100").
        #   * anything else                  -> left untouched rather
        #     than destroyed.
        if frequency and not cls._FREQUENCY_VOCAB_RE.search(
            str(frequency)
        ):

            frequency_text = str(frequency).strip()

            if cls._MED_STRENGTH_RE.search(
                frequency_text
            ):

                dose = cls._merge_dose_value(
                    dose,
                    frequency_text,
                )

                frequency = None

            elif cls._dose_is_bare_number_text(
                frequency_text
            ):

                if notes is not None:

                    label = name or "unnamed medication"

                    notes.append(
                        f"Medication '{label}': the value "
                        f"'{frequency_text}' was reported as a "
                        "frequency but is a bare number with no "
                        "unit or schedule. Its role could not be "
                        "determined from the document, so it was "
                        "not asserted as a frequency or a dose."
                    )

                frequency = None

        elif frequency and not dose:

            # The frequency IS a genuine schedule, but a
            # parenthesised group holding nothing but a number is
            # not part of one -- in prescription notation it is a
            # quantity or strength written apart from the drug name
            # ("Inj Xgeva - alt # (120)", the same document's
            # "T. Dexa (4)"). It is relocated to the empty "dose"
            # verbatim, without inventing a unit for it, and only
            # when "dose" is empty so a real dose is never
            # overwritten. Any other parenthetical -- "(max 6)",
            # "(2 tabs)", "(after food)" -- is left alone.
            paren_match = (
                cls._PAREN_BARE_NUMBER_RE.search(
                    str(frequency)
                )
            )

            if paren_match:

                dose = paren_match.group("num")

                remaining = re.sub(
                    r"\s+",
                    " ",
                    str(frequency)[:paren_match.start()]
                    + str(frequency)[paren_match.end():],
                ).strip(" .,/-")

                frequency = remaining or None

        # ---- 6. SOS/PRN/"as needed" normalization ---------------
        #
        # Canonicalizes any of: "SOS", "PRN", "as needed", or a
        # redundant combination of these, into a single value. SOS
        # (or PRN) is the more specific instruction, so when present
        # it is always the canonical value -- redundant "as needed"
        # phrasing alongside it is dropped rather than concatenated
        # (e.g. "as needed () sos" -> "sos", never "as needed sos").
        # The instruction always ends up in "frequency" and is
        # never left in "dose". Unrelated text in either field is
        # preserved, so a genuine "BD" is not lost.
        dose_text = str(dose) if dose else ""

        frequency_text = (
            str(frequency) if frequency else ""
        )

        has_sos = bool(
            cls._MED_SOS_RE.search(dose_text)
            or cls._MED_SOS_RE.search(frequency_text)
        )

        has_as_needed = bool(
            cls._MED_AS_NEEDED_RE.search(dose_text)
            or cls._MED_AS_NEEDED_RE.search(
                frequency_text
            )
        )

        if has_sos or has_as_needed:

            canonical = (
                "sos"
                if has_sos
                else "as needed"
            )

            dose = (
                cls._strip_as_needed_tokens(
                    dose_text
                )
                or None
            )

            frequency_remaining = (
                cls._strip_as_needed_tokens(
                    frequency_text
                )
            )

            frequency = (
                f"{frequency_remaining} {canonical}"
                if frequency_remaining
                else canonical
            )

        return {
            "name": name or None,
            "dose": cls._blank_to_none(
                cls._dedupe_repeated_strengths(
                    dose
                )
            ),
            "frequency": cls._blank_to_none(
                frequency
            ),
            "route": route,
            "duration": cls._blank_to_none(
                duration
            ),
            "indication": cls._blank_to_none(
                indication
            ),
        }

    # =========================================================
    # MEDICATION NORMALIZATION
    # =========================================================

    @classmethod
    def _normalize_medications(
        cls,
        medications: Any,
        notes: list[str] | None = None,
    ) -> list[dict[str, Any]]:

        if not isinstance(
            medications,
            list,
        ):
            return []

        output = []

        for item in medications:

            if isinstance(
                item,
                str,
            ):

                name = item.strip()

                if name:

                    output.append(
                        cls._parse_medication_fields(
                            {
                                "name": name,
                                "dose": None,
                                "frequency": None,
                                "route": None,
                                "duration": None,
                                "indication": None,
                            },
                            notes,
                        )
                    )

                continue

            if not isinstance(
                item,
                dict,
            ):
                continue

            name = cls._scalar(
                item.get(
                    "name"
                )
                or item.get(
                    "drug"
                )
                or item.get(
                    "medication"
                )
            )

            if name is None:
                continue

            entry = {
                "name": str(
                    name
                ).strip(),
                "dose": cls._string_value(
                    item.get("dose")
                ),
                "frequency": cls._string_value(
                    item.get("frequency")
                ),
                "route": cls._normalize_route(
                    item.get("route")
                ),
                "duration": cls._string_value(
                    item.get("duration")
                ),
                "indication": cls._string_value(
                    item.get("indication")
                ),
            }

            output.append(
                cls._parse_medication_fields(
                    entry,
                    notes,
                )
            )

        return output

    @classmethod
    def _string_value(
        cls,
        value: Any,
    ) -> str | None:

        value = cls._scalar(
            value
        )

        if value is None:
            return None

        return str(
            value
        ).strip()

    # =========================================================
    # SYMPTOMS
    # =========================================================

    @classmethod
    def _normalize_symptoms(
        cls,
        symptoms: Any,
    ) -> list[dict[str, Any]]:

        if not isinstance(
            symptoms,
            list,
        ):
            return []

        output = []

        for item in symptoms:

            if isinstance(
                item,
                str,
            ):

                text = item.strip()

                if text:

                    output.append(
                        {
                            "description": text
                        }
                    )

                continue

            if not isinstance(
                item,
                dict,
            ):
                continue

            description = cls._scalar(
                item.get(
                    "description"
                )
                or item.get(
                    "value"
                )
                or item.get(
                    "name"
                )
            )

            if description:

                output.append(
                    {
                        "description": str(
                            description
                        ).strip()
                    }
                )

        return output

    # =========================================================
    # CLINICAL ENTITIES
    # =========================================================

    @classmethod
    def _normalize_entities(
        cls,
        entities: Any,
    ) -> list[dict[str, Any]]:

        if not isinstance(
            entities,
            list,
        ):
            return []

        output = []

        for item in entities:

            if isinstance(
                item,
                str,
            ):

                text = item.strip()

                if text:

                    output.append(
                        {
                            "description": text,
                            "uncertainty": (
                                cls._detect_ambiguous_entity_uncertainty(
                                    text
                                )
                            ),
                        }
                    )

                continue

            if not isinstance(
                item,
                dict,
            ):
                continue

            description = cls._scalar(
                item.get(
                    "description"
                )
                or item.get(
                    "value"
                )
                or item.get(
                    "name"
                )
            )

            if not description:
                continue

            description = str(
                description
            ).strip()

            uncertainty = item.get(
                "uncertainty"
            )

            if uncertainty is not None:

                uncertainty = str(
                    cls._scalar(
                        uncertainty
                    )
                )

            else:

                # The LLM did not flag this entity as uncertain.
                # Independently check the text itself for signs of
                # OCR noise/garbling before trusting that silence
                # as confidence. See FINAL ISSUE #2.
                uncertainty = (
                    cls._detect_ambiguous_entity_uncertainty(
                        description
                    )
                )

            output.append(
                {
                    "description": description,
                    "uncertainty": uncertainty,
                }
            )

        return output

    # =========================================================
    # UNCERTAINTIES
    # =========================================================

    @classmethod
    def _normalize_uncertainties(
        cls,
        uncertainties: Any,
    ) -> list[dict[str, Any]]:

        if not isinstance(
            uncertainties,
            list,
        ):
            return []

        output = []

        for item in uncertainties:

            if isinstance(
                item,
                str,
            ):

                text = item.strip()

                if text:

                    output.append(
                        {
                            "description": text,
                            "source_blocks": [],
                        }
                    )

                continue

            if not isinstance(
                item,
                dict,
            ):
                continue

            description = cls._scalar(
                item.get(
                    "description"
                )
                or item.get(
                    "reason"
                )
                or item.get(
                    "text"
                )
                or item.get(
                    "value"
                )
            )

            if not description:
                continue

            source_blocks = item.get(
                "source_blocks",
                [],
            )

            if not isinstance(
                source_blocks,
                list,
            ):
                source_blocks = [
                    source_blocks
                ]

            normalized_blocks = []

            for block in source_blocks:

                if isinstance(
                    block,
                    int,
                ):

                    normalized_blocks.append(
                        block
                    )

                elif isinstance(
                    block,
                    str,
                ):

                    try:

                        normalized_blocks.append(
                            int(block)
                        )

                    except ValueError:
                        pass

            output.append(
                {
                    "description": str(
                        description
                    ).strip(),
                    "source_blocks": normalized_blocks,
                }
            )

        return output

    # =========================================================
    # AYUSH
    # =========================================================

    @classmethod
    def _normalize_ayush(
        cls,
        ayush: Any,
    ) -> dict[str, Any]:

        if not isinstance(
            ayush,
            dict,
        ):
            ayush = {}

        return {
            "ahara_vihara": cls._scalar(
                ayush.get(
                    "ahara_vihara"
                )
            ),
            "prakriti": cls._scalar(
                ayush.get(
                    "prakriti"
                )
            ),
            "vikriti": cls._scalar(
                ayush.get(
                    "vikriti"
                )
            ),
        }

    # =========================================================
    # COMPLETE NORMALIZATION
    # =========================================================

    @classmethod
    def _normalize_extraction_payload(
        cls,
        data: dict[str, Any],
    ) -> dict[str, Any]:

        if not isinstance(
            data,
            dict,
        ):
            return data

        clinical_data = data.get(
            "clinical_data"
        )

        if not isinstance(
            clinical_data,
            dict,
        ):
            clinical_data = {}

        # -----------------------------------------------------
        # PATIENT
        # -----------------------------------------------------

        clinical_data[
            "patient"
        ] = cls._normalize_patient(
            clinical_data.get(
                "patient"
            )
        )

        # -----------------------------------------------------
        # ENCOUNTER
        # -----------------------------------------------------

        encounter = clinical_data.get(
            "encounter"
        )

        if not isinstance(
            encounter,
            dict,
        ):
            encounter = {}

        for field in (
            "department",
            "visit_type",
            "collected_on",
            "reported_on",
        ):

            encounter[field] = cls._string_value(
                encounter.get(field)
            )

        clinical_data[
            "encounter"
        ] = encounter

        # -----------------------------------------------------
        # REPORT
        # -----------------------------------------------------

        report = clinical_data.get(
            "report"
        )

        if not isinstance(
            report,
            dict,
        ):
            report = {}

        for field in (
            "type",
            "panel",
            "status",
        ):

            report[field] = cls._string_value(
                report.get(field)
            )

        clinical_data[
            "report"
        ] = report

        # -----------------------------------------------------
        # ARRAYS
        # -----------------------------------------------------

        for field in (
            "clinical_results",
            "diagnoses",
            "procedures",
        ):

            if not isinstance(
                clinical_data.get(field),
                list,
            ):

                clinical_data[field] = []

        # -----------------------------------------------------
        # MEDICATIONS
        # -----------------------------------------------------
        #
        # Deterministic field re-derivation can discover values the
        # model misfiled and whose true role is not recoverable from
        # the document. Those are collected here and reported as
        # uncertainties below rather than being guessed into a field.
        # -----------------------------------------------------

        medication_notes: list[str] = []

        clinical_data[
            "medications"
        ] = cls._normalize_medications(
            clinical_data.get(
                "medications"
            ),
            medication_notes,
        )

        # -----------------------------------------------------
        # SYMPTOMS
        # -----------------------------------------------------

        clinical_data[
            "symptoms"
        ] = cls._normalize_symptoms(
            clinical_data.get(
                "symptoms"
            )
        )

        # -----------------------------------------------------
        # CLINICAL ENTITIES
        # -----------------------------------------------------

        clinical_data[
            "clinical_entities"
        ] = cls._normalize_entities(
            clinical_data.get(
                "clinical_entities"
            )
        )

        # -----------------------------------------------------
        # AYUSH
        # -----------------------------------------------------

        clinical_data[
            "ayush_parameters"
        ] = cls._normalize_ayush(
            clinical_data.get(
                "ayush_parameters"
            )
        )

        # -----------------------------------------------------
        # METADATA
        # -----------------------------------------------------

        metadata = data.get(
            "metadata"
        )

        if not isinstance(
            metadata,
            dict,
        ):
            metadata = {}

        confidence = metadata.get(
            "extraction_confidence",
            0.0,
        )

        try:
            confidence = float(
                confidence
            )

        except (
            TypeError,
            ValueError,
        ):
            confidence = 0.0

        metadata[
            "extraction_confidence"
        ] = max(
            0.0,
            min(
                1.0,
                confidence,
            ),
        )

        metadata[
            "requires_manual_review"
        ] = bool(
            metadata.get(
                "requires_manual_review",
                False,
            )
        )

        metadata[
            "uncertainties"
        ] = cls._normalize_uncertainties(
            metadata.get(
                "uncertainties"
            )
        )

        # Surface anything the medication normalizer could not
        # confidently place. Duplicates are not re-added.
        existing_uncertainties = {
            item.get("description")
            for item in metadata["uncertainties"]
        }

        for note in medication_notes:

            if note in existing_uncertainties:
                continue

            existing_uncertainties.add(
                note
            )

            metadata["uncertainties"].append(
                {
                    "description": note,
                    "source_blocks": [],
                }
            )

            # An unplaceable value must be seen by a human.
            metadata[
                "requires_manual_review"
            ] = True

        data[
            "clinical_data"
        ] = clinical_data

        data[
            "metadata"
        ] = metadata

        return data

    # =========================================================
    # AMBIGUOUS-ENTITY REVIEW PROPAGATION
    # =========================================================

    @classmethod
    def _apply_uncertain_entity_review_flag(
        cls,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        An ambiguous clinical entity (a non-null "uncertainty") must
        be capable of independently forcing manual review, even if
        overall confidence would otherwise clear the review
        threshold. This never lowers confidence -- it only ensures
        the review flag is correct. See FINAL ISSUE #3.
        """

        clinical_data = data.get(
            "clinical_data"
        )

        if not isinstance(
            clinical_data,
            dict,
        ):
            return data

        entities = clinical_data.get(
            "clinical_entities",
            [],
        )

        if not isinstance(
            entities,
            list,
        ):
            return data

        has_uncertain_entity = any(
            isinstance(entity, dict)
            and entity.get("uncertainty")
            for entity in entities
        )

        if has_uncertain_entity:

            metadata = data.get(
                "metadata"
            )

            if not isinstance(
                metadata,
                dict,
            ):
                metadata = {}

            metadata[
                "requires_manual_review"
            ] = True

            data["metadata"] = metadata

        return data

    # =========================================================
    # GROUNDING / HALLUCINATION CONTROL
    # =========================================================

    @staticmethod
    def _normalise_for_grounding(value: Any) -> str:
        """Create a conservative comparison representation."""
        if value is None:
            return ""
        text = str(value).lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @classmethod
    def _grounded_in_ocr(
        cls,
        value: Any,
        corrected_ocr: str,
    ) -> bool:
        """
        Return True only when the extracted value has reasonable
        lexical support in corrected OCR.

        Short/common clinical words are deliberately handled
        conservatively to avoid deleting legitimate findings.

        NOTE: this algorithm intentionally mirrors
        `DocumentAIPipeline._is_grounded` in pipeline.py. That copy
        is a provider-agnostic safety net that also runs on this
        engine's output. Keep both in sync if this changes.
        """
        needle = cls._normalise_for_grounding(value)
        haystack = cls._normalise_for_grounding(corrected_ocr)

        if not needle or not haystack:
            return False

        if needle in haystack:
            return True

        tokens = [
            token for token in needle.split()
            if len(token) >= 3
        ]

        if not tokens:
            return False

        hay_tokens = set(haystack.split())
        matched = sum(token in hay_tokens for token in tokens)

        # Multi-token values require most meaningful tokens.
        if len(tokens) >= 2:
            return matched >= max(1, len(tokens) - 1)

        return matched == len(tokens)

    # Generic hospital/service-catalog boilerplate that must never
    # become a patient clinical entity, even when it is textually
    # present in the OCR (an ad or service menu is still "in" the
    # document, so plain grounding alone would let it through).
    # Deliberately narrow: only unambiguous contact/marketing/URL
    # patterns, and only ever applied to clinical_entities -- real
    # symptoms/diagnoses/procedures/medications should never match
    # this and are never filtered by it.
    _NON_CLINICAL_ENTITY_PATTERN = re.compile(
        r"""
        \bwww\. |
        https?:// |
        @[a-z0-9.\-]+\.[a-z]{2,} |
        \btoll[\s-]?free\b |
        \bhelpline\b |
        \bcustomer\ care\b |
        \bterms\ (and|&)\ conditions\b |
        \binsurance\ claim\b |
        \bfor\ more\ (details|information)\b |
        \bcontact\ us\b |
        \bappointment\ booking\b |
        \bhome\ visit\ charges?\b |
        \bconsultation\ (fee|charges?)\b |
        \bmembership\b |
        \btariff\b |
        \brate\ card\b |
        \bdownload\ (the\ )?app\b |
        \b\d{10}\b
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    @classmethod
    def _looks_like_boilerplate(
        cls,
        value: Any,
    ) -> bool:

        if value is None:
            return False

        return bool(
            cls._NON_CLINICAL_ENTITY_PATTERN.search(
                str(value)
            )
        )

    # Bare generic service-catalog items (e.g. from a "Care@Home
    # doorstep services include: ..." menu). These are matched by
    # EXACT phrase only -- never by substring/regex -- so a genuine
    # patient-specific instruction that merely shares a word (e.g.
    # "physiotherapy advised", "nursing care required post-op") can
    # never be caught by this list.
    #
    # An exact match is necessary but NOT sufficient to filter: the
    # phrase must ALSO occur in a service-catalog context in the
    # document (see _in_service_catalog_context). A prescription that
    # genuinely advises "physiotherapy" as a bare line is therefore
    # preserved, while the identical word inside a services menu is
    # discarded. That distinction is what makes this a context rule
    # rather than a banned-word list.
    _GENERIC_SERVICE_CATALOG_PHRASES = frozenset(
        {
            "laboratory sample collection",
            "sample collection",
            "nursing care",
            "physiotherapy",
            "doctor's services",
            "doctors services",
            "doctor services",
            "home visit",
            "home nursing",
            "diagnostic services",
            "ambulance services",
            "medical equipment rental",
        }
    )

    # Markers that identify a line as part of a service/package menu
    # rather than patient-specific clinical content.
    _SERVICE_CATALOG_CONTEXT_RE = re.compile(
        r"""
        \bservices?\ (include|includes|offered|available)\b |
        \bdoorstep\b |
        \bcare\s*@\s*home\b |
        \bhome\ care\ services?\b |
        \bour\ services\b |
        \bwe\ (also\ )?(offer|provide)\b |
        \bavailable\ services\b |
        \bfacilities\ (include|available)\b |
        \bpackages?\ include\b |
        \bservice\ menu\b
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    @classmethod
    def _is_generic_service_catalog_phrase(
        cls,
        value: Any,
    ) -> bool:

        if not value:
            return False

        normalized = re.sub(
            r"[^a-z0-9 ]",
            "",
            str(value).lower(),
        ).strip()

        normalized = re.sub(
            r"\s+",
            " ",
            normalized,
        )

        return (
            normalized
            in cls._GENERIC_SERVICE_CATALOG_PHRASES
        )

    @classmethod
    def _in_service_catalog_context(
        cls,
        value: Any,
        corrected_ocr: str,
    ) -> bool:
        """
        True only when EVERY occurrence of `value` in the corrected
        OCR sits on (or directly under) a service/package menu line.

        This is what distinguishes a generic service catalog from a
        patient-specific clinical instruction. If the same phrase
        also appears anywhere outside a menu context, it is treated
        as potentially genuine and this returns False -- the system
        prefers keeping a real instruction over deleting it.
        """

        if not value or not corrected_ocr:
            return False

        needle = cls._normalise_for_grounding(
            value
        )

        if not needle:
            return False

        lines = str(
            corrected_ocr
        ).splitlines()

        found = False

        for index, line in enumerate(lines):

            if needle not in cls._normalise_for_grounding(
                line
            ):
                continue

            found = True

            # A menu header is often on an earlier line than the
            # item itself, so the context window is the whole
            # contiguous block of non-blank lines ending at this
            # line. A blank line is treated as a block boundary,
            # which keeps the window from reaching into unrelated
            # (e.g. prescription) sections of the document.
            start = index

            while (
                start > 0
                and lines[start - 1].strip()
            ):
                start -= 1

            window = " ".join(
                lines[start:index + 1]
            )

            if not cls._SERVICE_CATALOG_CONTEXT_RE.search(
                window
            ):
                # Occurs somewhere that is not a services menu.
                return False

        return found

    @classmethod
    def _is_service_catalog_item(
        cls,
        value: Any,
        corrected_ocr: str,
    ) -> bool:
        """
        A generic service name that appears ONLY inside a service
        menu is catalog boilerplate, not patient clinical data.
        Both conditions are required.
        """

        return (
            cls._is_generic_service_catalog_phrase(
                value
            )
            and cls._in_service_catalog_context(
                value,
                corrected_ocr,
            )
        )

    @classmethod
    def _ground_extraction(
        cls,
        data: dict[str, Any],
        corrected_ocr: str,
    ) -> dict[str, Any]:
        """
        Remove clearly ungrounded LLM-generated clinical entities.

        Ambiguous but explicitly present entities are retained and
        receive an uncertainty entry rather than being guessed.
        """
        clinical_data = data.get("clinical_data")
        if not isinstance(clinical_data, dict):
            return data

        metadata = data.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}

        uncertainties = cls._normalize_uncertainties(
            metadata.get("uncertainties")
        )

        def add_uncertainty(description: str) -> None:
            if not any(
                item.get("description") == description
                for item in uncertainties
            ):
                uncertainties.append(
                    {
                        "description": description,
                        "source_blocks": [],
                    }
                )

        # Generic entity descriptions are especially prone to hallucination.
        entities = clinical_data.get("clinical_entities", [])
        grounded_entities = []

        for entity in entities if isinstance(entities, list) else []:
            if not isinstance(entity, dict):
                continue

            description = entity.get("description")
            if not description:
                add_uncertainty(
                    "Extraction returned a clinical entity with no "
                    "description; it was dropped rather than guessed."
                )
                continue

            if cls._looks_like_boilerplate(
                description
            ) or cls._is_service_catalog_item(
                description,
                corrected_ocr,
            ):
                # Generic hospital/service/ad/contact text, even if
                # textually present in the OCR, is not patient
                # clinical data.
                add_uncertainty(
                    "Extraction omitted a non-clinical (boilerplate/"
                    f"service/contact) entity: '{description}'."
                )
                continue

            if cls._grounded_in_ocr(description, corrected_ocr):
                grounded_entities.append(entity)
            else:
                # Do not silently invent an entity. Record why it was removed.
                add_uncertainty(
                    f"Extraction omitted ungrounded clinical entity: "
                    f"'{description}'."
                )

        clinical_data["clinical_entities"] = grounded_entities

        # Medication names must be grounded. If present in OCR, preserve
        # the medication even if the name itself is ambiguous.
        medications = clinical_data.get("medications", [])
        grounded_medications = []

        for medication in medications if isinstance(medications, list) else []:
            if not isinstance(medication, dict):
                continue

            name = medication.get("name")
            if not name:
                add_uncertainty(
                    "Extraction returned a medication with no name; "
                    "it was dropped rather than guessed."
                )
                continue

            if cls._grounded_in_ocr(name, corrected_ocr):
                grounded_medications.append(medication)
            else:
                add_uncertainty(
                    f"Extraction omitted ungrounded medication: '{name}'."
                )

        clinical_data["medications"] = grounded_medications

        # Diagnoses, procedures and symptoms should also be grounded.
        for field, label in (
            ("diagnoses", "diagnosis"),
            ("procedures", "procedure"),
            ("symptoms", "symptom"),
        ):
            values = clinical_data.get(field, [])
            if not isinstance(values, list):
                clinical_data[field] = []
                continue

            grounded = []

            for item in values:
                if not isinstance(item, dict):
                    continue

                description = (
                    item.get("description")
                    or item.get("name")
                    or item.get("value")
                )

                if not description:
                    add_uncertainty(
                        f"Extraction returned a {label} with no "
                        "description; it was dropped rather than guessed."
                    )
                    continue

                # A generic service name lifted out of a services
                # menu is not a patient procedure/diagnosis/symptom.
                # Patient-specific wording (e.g. "Physiotherapy
                # advised") is never matched here -- see
                # _is_service_catalog_item.
                if cls._is_service_catalog_item(
                    description,
                    corrected_ocr,
                ):
                    add_uncertainty(
                        f"Extraction omitted a generic service-catalog "
                        f"{label}: '{description}'."
                    )
                    continue

                if cls._grounded_in_ocr(
                    description,
                    corrected_ocr,
                ):
                    grounded.append(item)
                else:
                    add_uncertainty(
                        f"Extraction omitted ungrounded {label}: "
                        f"'{description}'."
                    )

            clinical_data[field] = grounded

        metadata["uncertainties"] = uncertainties

        # Any grounding removal requires manual review.
        if uncertainties:
            metadata["requires_manual_review"] = True

        data["clinical_data"] = clinical_data
        data["metadata"] = metadata
        return data

    # =========================================================
    # PARSE RESPONSE
    # =========================================================

    @classmethod
    def _parse_response(
        cls,
        content: str,
        *,
        corrected_ocr: str = "",
        ocr_blocks: list[dict[str, Any]] | None = None,
    ) -> ABDMExtractionResult:

        if not isinstance(
            content,
            str,
        ):
            raise ValueError(
                "Mistral response must be a string."
            )

        cleaned = cls._strip_code_fences(
            content
        )

        cleaned = cls._extract_json_object(
            cleaned
        )

        try:

            data = json.loads(
                cleaned
            )

        except json.JSONDecodeError as exc:

            raise ValueError(
                "Mistral returned invalid JSON.\n\n"
                f"JSON error: {exc}\n\n"
                f"Response:\n{cleaned}"
            ) from exc

        if not isinstance(
            data,
            dict,
        ):

            raise ValueError(
                "Mistral extraction response "
                "must be a JSON object."
            )

        # =====================================================
        # CRITICAL
        #
        # Normalize EVERYTHING before Pydantic validation.
        # =====================================================

        data = cls._normalize_extraction_payload(
            data
        )

        # =====================================================
        # GROUNDING / HALLUCINATION CONTROL
        # =====================================================

        data = cls._ground_extraction(
            data,
            corrected_ocr=corrected_ocr,
        )

        # =====================================================
        # AMBIGUOUS-ENTITY REVIEW PROPAGATION
        # =====================================================

        data = cls._apply_uncertain_entity_review_flag(
            data
        )

        # =====================================================
        # FINAL SCHEMA VALIDATION
        # =====================================================

        try:

            return (
                ABDMExtractionResult
                .model_validate(
                    data
                )
            )

        except Exception as exc:

            normalized_json = json.dumps(
                data,
                indent=2,
                ensure_ascii=False,
            )

            raise ValueError(
                "Mistral returned valid JSON, "
                "but it does not match the ML2 "
                "extraction schema after normalization.\n\n"
                f"Validation error:\n{exc}\n\n"
                "NORMALIZED DATA:\n"
                f"{normalized_json}"
            ) from exc
