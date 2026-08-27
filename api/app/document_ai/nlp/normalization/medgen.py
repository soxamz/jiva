from __future__ import annotations

import html
import os
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

import requests


NCBI_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


# ============================================================
# DATA MODELS
# ============================================================


@dataclass
class MedGenCandidate:
    uid: str | None
    concept_id: str | None
    title: str | None
    synonyms: list[str]
    semantic_type: str | None
    score: float
    exact_match: bool
    match_type: str


@dataclass
class MedGenResult:
    original: str
    preferred_name: str | None
    concept_id: str | None
    source: str | None
    exact_match: bool
    confidence: float
    matched: bool
    requires_review: bool
    match_type: str | None = None


# ============================================================
# MEDGEN CLIENT
# ============================================================


class MedGenClient:
    """
    Safe NCBI MedGen terminology client.

    Important design rule:

    MedGen search ranking is NOT treated as clinical truth.

    A generic term such as:

        hypertension

    must not automatically become:

        stable hypertension
        ocular hypertension
        pregnancy-induced hypertension
        drug-induced hypertension
        CTCAE hypertension

    unless the requested term itself actually matches the
    returned MedGen concept.

    Exact preferred-name and exact synonym matches are safest.

    Fuzzy matches are conservative and require review.
    """

    def __init__(
        self,
        email: str | None = None,
        tool: str | None = None,
        api_key: str | None = None,
        timeout: float = 20.0,
    ) -> None:

        self.email = (
            email
            or os.getenv("NCBI_EMAIL")
            or ""
        ).strip()

        self.tool = (
            tool
            or os.getenv(
                "NCBI_TOOL",
                "JivaMedicalDocumentAI",
            )
        ).strip()

        self.api_key = (
            api_key
            or os.getenv("NCBI_API_KEY")
            or ""
        ).strip()

        self.timeout = timeout

        self.session = requests.Session()

        self.session.headers.update(
            {
                "User-Agent": (
                    f"{self.tool}/1.0 "
                    f"({self.email or 'no-email'})"
                )
            }
        )

        # Exact terminology match.
        self.exact_confidence = 0.95

        # Fuzzy matches are never automatically treated as
        # exact medical normalization.
        self.fuzzy_threshold = 0.92

        self.last_request_time = 0.0

    # ========================================================
    # PUBLIC LOOKUP
    # ========================================================

    def lookup(
        self,
        term: str,
        retmax: int = 50,
    ) -> list[dict[str, Any]]:

        term = (
            term or ""
        ).strip()

        if not term:
            return []

        ids: list[str] = []

        # ----------------------------------------------------
        # 1. Exact title search
        # ----------------------------------------------------

        try:

            found = self._search(
                f'"{term}"[exacttitle]',
                retmax=retmax,
            )

            self._append_unique(
                ids,
                found,
            )

        except requests.RequestException:
            pass

        # ----------------------------------------------------
        # 2. Exact term variants
        # ----------------------------------------------------

        try:

            found = (
                self._search_exact_term_variants(
                    term,
                    retmax=retmax,
                )
            )

            self._append_unique(
                ids,
                found,
            )

        except requests.RequestException:
            pass

        # ----------------------------------------------------
        # 3. Normal search
        # ----------------------------------------------------

        try:

            found = self._search(
                term,
                retmax=retmax,
            )

            self._append_unique(
                ids,
                found,
            )

        except requests.RequestException:
            pass

        if not ids:
            return []

        return self._summary(
            ids
        )

    # ========================================================
    # NORMALIZE
    # ========================================================

    def normalize(
        self,
        term: str,
    ) -> MedGenResult:

        original = (
            term or ""
        ).strip()

        if not original:

            return MedGenResult(
                original="",
                preferred_name=None,
                concept_id=None,
                source=None,
                exact_match=False,
                confidence=0.0,
                matched=False,
                requires_review=True,
                match_type="empty",
            )

        results = self.lookup(
            original,
            retmax=50,
        )

        candidate = self._select_best(
            original,
            results,
        )

        if candidate is None:

            return MedGenResult(
                original=original,
                preferred_name=None,
                concept_id=None,
                source=None,
                exact_match=False,
                confidence=0.0,
                matched=False,
                requires_review=True,
                match_type="no_candidate",
            )

        # ====================================================
        # EXACT MATCH
        # ====================================================

        if candidate.exact_match:

            return MedGenResult(
                original=original,
                preferred_name=candidate.title,
                concept_id=candidate.concept_id,
                source=candidate.semantic_type,
                exact_match=True,
                confidence=self.exact_confidence,
                matched=True,
                requires_review=False,
                match_type=candidate.match_type,
            )

        # ====================================================
        # FUZZY MATCH
        # ====================================================

        if (
            candidate.score
            >= self.fuzzy_threshold
            and self._is_safe_generic_match(
                original,
                candidate,
            )
        ):

            return MedGenResult(
                original=original,
                preferred_name=candidate.title,
                concept_id=candidate.concept_id,
                source=candidate.semantic_type,
                exact_match=False,
                confidence=round(
                    candidate.score,
                    4,
                ),
                matched=True,
                requires_review=True,
                match_type=candidate.match_type,
            )

        # ====================================================
        # WEAK / UNSAFE
        # ====================================================

        return MedGenResult(
            original=original,
            preferred_name=None,
            concept_id=None,
            source=None,
            exact_match=False,
            confidence=round(
                candidate.score,
                4,
            ),
            matched=False,
            requires_review=True,
            match_type="weak",
        )

    # ========================================================
    # EXACT TERM SEARCH
    # ========================================================

    def _search_exact_term_variants(
        self,
        term: str,
        retmax: int = 50,
    ) -> list[str]:

        queries = [
            f'"{term}"[All Fields]',
            f'"{term}"[MeSH Terms]',
            f'"{term}"[Other Term]',
        ]

        ids: list[str] = []

        for query in queries:

            try:

                found = self._search(
                    query,
                    retmax=retmax,
                )

            except requests.RequestException:
                continue

            self._append_unique(
                ids,
                found,
            )

        return ids

    # ========================================================
    # ESEARCH
    # ========================================================

    def _search(
        self,
        term: str,
        retmax: int,
    ) -> list[str]:

        params: dict[str, Any] = {
            "db": "medgen",
            "term": term,
            "retmax": retmax,
            "retmode": "json",
            "tool": self.tool,
        }

        if self.email:
            params["email"] = self.email

        if self.api_key:
            params["api_key"] = self.api_key

        self._rate_limit()

        response = self.session.get(
            f"{NCBI_BASE_URL}/esearch.fcgi",
            params=params,
            timeout=self.timeout,
        )

        response.raise_for_status()

        payload = response.json()

        return [
            str(uid)
            for uid in (
                payload
                .get("esearchresult", {})
                .get("idlist", [])
            )
        ]

    # ========================================================
    # ESUMMARY
    # ========================================================

    def _summary(
        self,
        ids: list[str],
    ) -> list[dict[str, Any]]:

        if not ids:
            return []

        params: dict[str, Any] = {
            "db": "medgen",
            "id": ",".join(ids),
            "retmode": "json",
            "tool": self.tool,
        }

        if self.email:
            params["email"] = self.email

        if self.api_key:
            params["api_key"] = self.api_key

        self._rate_limit()

        response = self.session.get(
            f"{NCBI_BASE_URL}/esummary.fcgi",
            params=params,
            timeout=self.timeout,
        )

        response.raise_for_status()

        payload = response.json()

        result = payload.get(
            "result",
            {},
        )

        output: list[dict[str, Any]] = []

        for uid in ids:

            item = result.get(
                str(uid)
            )

            if isinstance(
                item,
                dict,
            ):
                output.append(item)

        return output

    # ========================================================
    # CANDIDATE RANKING
    # ========================================================

    def _select_best(
        self,
        entity: str,
        results: list[dict[str, Any]],
    ) -> MedGenCandidate | None:

        target = self._clean(
            entity
        )

        if not target:
            return None

        candidates: list[
            MedGenCandidate
        ] = []

        for result in results:

            title = self._extract_name(
                result
            )

            if not title:
                continue

            title_clean = self._clean(
                title
            )

            synonyms = (
                self._extract_synonyms(
                    result
                )
            )

            semantic_type = (
                self._extract_semantic_type(
                    result
                )
            )

            uid = self._string_or_none(
                result.get("uid")
            )

            concept_id = (
                self._extract_concept_id(
                    result
                )
            )

            # ------------------------------------------------
            # EXACT PREFERRED NAME
            # ------------------------------------------------

            if title_clean == target:

                candidates.append(
                    MedGenCandidate(
                        uid=uid,
                        concept_id=concept_id,
                        title=title,
                        synonyms=synonyms,
                        semantic_type=semantic_type,
                        score=1.0,
                        exact_match=True,
                        match_type=(
                            "exact_preferred_name"
                        ),
                    )
                )

                continue

            # ------------------------------------------------
            # EXACT SYNONYM
            # ------------------------------------------------

            exact_synonym = False
            best_synonym_score = 0.0

            for synonym in synonyms:

                synonym_clean = (
                    self._clean(
                        synonym
                    )
                )

                if not synonym_clean:
                    continue

                if synonym_clean == target:

                    exact_synonym = True
                    best_synonym_score = 1.0
                    break

                similarity = (
                    SequenceMatcher(
                        None,
                        target,
                        synonym_clean,
                    ).ratio()
                )

                best_synonym_score = max(
                    best_synonym_score,
                    similarity,
                )

            if exact_synonym:

                candidates.append(
                    MedGenCandidate(
                        uid=uid,
                        concept_id=concept_id,
                        title=title,
                        synonyms=synonyms,
                        semantic_type=semantic_type,
                        score=1.0,
                        exact_match=True,
                        match_type="exact_synonym",
                    )
                )

                continue

            # ------------------------------------------------
            # TITLE SIMILARITY
            # ------------------------------------------------

            title_score = (
                SequenceMatcher(
                    None,
                    target,
                    title_clean,
                ).ratio()
            )

            # ------------------------------------------------
            # TOKEN SIMILARITY
            # ------------------------------------------------

            token_score = (
                self._token_similarity(
                    target,
                    title_clean,
                )
            )

            # ------------------------------------------------
            # SYNONYM SIMILARITY
            # ------------------------------------------------

            score = max(
                title_score,
                token_score,
                best_synonym_score,
            )

            # ------------------------------------------------
            # SPECIFICITY PENALTY
            # ------------------------------------------------

            score -= (
                self._specificity_penalty(
                    target,
                    title_clean,
                )
            )

            # ------------------------------------------------
            # SEMANTIC BONUS
            # ------------------------------------------------

            score += (
                self._semantic_bonus(
                    semantic_type
                )
            )

            score = max(
                0.0,
                min(
                    1.0,
                    score,
                ),
            )

            match_type = (
                "fuzzy_synonym"
                if best_synonym_score
                >= max(
                    title_score,
                    token_score,
                )
                else "fuzzy_title"
            )

            candidates.append(
                MedGenCandidate(
                    uid=uid,
                    concept_id=concept_id,
                    title=title,
                    synonyms=synonyms,
                    semantic_type=semantic_type,
                    score=score,
                    exact_match=False,
                    match_type=match_type,
                )
            )

        if not candidates:
            return None

        candidates.sort(
            key=self._candidate_sort_key,
            reverse=True,
        )

        return candidates[0]

    # ========================================================
    # SAFE GENERIC MATCH
    # ========================================================

    def _is_safe_generic_match(
        self,
        target: str,
        candidate: MedGenCandidate,
    ) -> bool:

        target_clean = self._clean(
            target
        )

        title_clean = self._clean(
            candidate.title or ""
        )

        if not target_clean:
            return False

        # Exact match is always safe.
        if title_clean == target_clean:
            return True

        # Exact synonym should already have been caught
        # earlier, but keep this protection here.
        for synonym in candidate.synonyms:

            if (
                self._clean(
                    synonym
                )
                == target_clean
            ):
                return True

        # ----------------------------------------------------
        # A generic target must NOT become a more-specific
        # medical concept.
        # ----------------------------------------------------

        specific_modifiers = {
            "ocular",
            "pregnancy",
            "pregnancy induced",
            "pregnancy-induced",
            "drug",
            "drug induced",
            "drug-induced",
            "secondary",
            "stable",
            "acute",
            "chronic",
            "postpartum",
            "maternal",
            "left",
            "right",
            "bilateral",
            "unilateral",
            "primary",
            "congenital",
            "neonatal",
            "pediatric",
            "paediatric",
            "grade",
            "stage",
            "ctcae",
            "due",
            "associated",
            "caused",
        }

        target_tokens = set(
            target_clean.split()
        )

        title_tokens = set(
            title_clean.split()
        )

        extra_tokens = (
            title_tokens
            - target_tokens
        )

        # Any specific modifier makes the candidate
        # unsafe as a generic normalization.
        for modifier in specific_modifiers:

            modifier_tokens = set(
                modifier.split()
            )

            if modifier_tokens.issubset(
                extra_tokens
            ):
                return False

        # Generic fuzzy match is only allowed when the
        # candidate is essentially the same phrase.
        return (
            candidate.score
            >= self.fuzzy_threshold
            and self._token_overlap(
                target_clean,
                title_clean,
            )
            >= 0.80
        )

    # ========================================================
    # TOKEN OVERLAP
    # ========================================================

    @staticmethod
    def _token_overlap(
        first: str,
        second: str,
    ) -> float:

        first_tokens = set(
            first.split()
        )

        second_tokens = set(
            second.split()
        )

        if not first_tokens:
            return 0.0

        intersection = (
            first_tokens
            & second_tokens
        )

        return (
            len(intersection)
            / len(first_tokens)
        )

    # ========================================================
    # TOKEN SIMILARITY
    # ========================================================

    @staticmethod
    def _token_similarity(
        first: str,
        second: str,
    ) -> float:

        first_tokens = set(
            first.split()
        )

        second_tokens = set(
            second.split()
        )

        if not first_tokens:
            return 0.0

        intersection = (
            first_tokens
            & second_tokens
        )

        union = (
            first_tokens
            | second_tokens
        )

        if not union:
            return 0.0

        jaccard = (
            len(intersection)
            / len(union)
        )

        sequence = (
            SequenceMatcher(
                None,
                first,
                second,
            ).ratio()
        )

        return (
            0.55 * sequence
            + 0.45 * jaccard
        )

    # ========================================================
    # SPECIFICITY PENALTY
    # ========================================================

    @staticmethod
    def _specificity_penalty(
        target: str,
        title: str,
    ) -> float:

        target_tokens = set(
            target.split()
        )

        title_tokens = set(
            title.split()
        )

        extra_tokens = (
            title_tokens
            - target_tokens
        )

        if not extra_tokens:
            return 0.0

        specific_modifiers = {
            "acute",
            "chronic",
            "essential",
            "secondary",
            "primary",
            "severe",
            "mild",
            "moderate",
            "malignant",
            "benign",
            "pregnancy",
            "pregnancy-induced",
            "drug-induced",
            "ocular",
            "retinal",
            "pulmonary",
            "portal",
            "gestational",
            "neonatal",
            "pediatric",
            "paediatric",
            "grade",
            "stage",
            "ctcae",
            "postpartum",
            "maternal",
            "stable",
            "bilateral",
            "unilateral",
            "left",
            "right",
            "syndrome",
        }

        modifier_count = sum(
            1
            for token in extra_tokens
            if token in specific_modifiers
        )

        return min(
            0.15,
            modifier_count * 0.05,
        )

    # ========================================================
    # SEMANTIC BONUS
    # ========================================================

    @staticmethod
    def _semantic_bonus(
        semantic_type: str | None,
    ) -> float:

        if not semantic_type:
            return 0.0

        value = (
            semantic_type
            .lower()
            .strip()
        )

        if value in {
            "disease or syndrome",
            "disease",
            "syndrome",
        }:
            return 0.03

        if value in {
            "finding",
            "clinical attribute",
        }:
            return 0.015

        return 0.0

    # ========================================================
    # SEMANTIC RANK
    # ========================================================

    @staticmethod
    def _semantic_rank(
        semantic_type: str | None,
    ) -> int:

        if not semantic_type:
            return 0

        value = (
            semantic_type
            .lower()
            .strip()
        )

        if value in {
            "disease or syndrome",
            "disease",
            "syndrome",
        }:
            return 3

        if value in {
            "finding",
            "clinical attribute",
        }:
            return 2

        return 1

    # ========================================================
    # CANDIDATE SORT
    # ========================================================

    @staticmethod
    def _candidate_sort_key(
        candidate: MedGenCandidate,
    ) -> tuple:

        exact_priority = (
            1
            if candidate.exact_match
            else 0
        )

        semantic_priority = (
            MedGenClient._semantic_rank(
                candidate.semantic_type
            )
        )

        title_length_penalty = (
            len(
                candidate.title or ""
            )
            * 0.0001
        )

        return (
            exact_priority,
            candidate.score,
            semantic_priority,
            -title_length_penalty,
        )

    # ========================================================
    # NAME EXTRACTION
    # ========================================================

    @staticmethod
    def _extract_name(
        result: dict[str, Any],
    ) -> str | None:

        for key in (
            "title",
            "name",
            "preferred_name",
        ):

            value = result.get(
                key
            )

            if (
                isinstance(
                    value,
                    str,
                )
                and value.strip()
            ):
                return value.strip()

        return None

    # ========================================================
    # CONCEPT ID
    # ========================================================

    @staticmethod
    def _extract_concept_id(
        result: dict[str, Any],
    ) -> str | None:

        for key in (
            "conceptid",
            "concept_id",
            "ConceptId",
        ):

            value = result.get(
                key
            )

            if value is not None:

                value = str(
                    value
                ).strip()

                if value:
                    return value

        return None

    # ========================================================
    # SEMANTIC TYPE
    # ========================================================

    @staticmethod
    def _extract_semantic_type(
        result: dict[str, Any],
    ) -> str | None:

        semantic = result.get(
            "semantictype"
        )

        if isinstance(
            semantic,
            dict,
        ):

            value = semantic.get(
                "value"
            )

            if isinstance(
                value,
                str,
            ):
                return value.strip()

        if isinstance(
            semantic,
            list,
        ):

            for item in semantic:

                if isinstance(
                    item,
                    str,
                ):
                    return item.strip()

                if isinstance(
                    item,
                    dict,
                ):

                    value = item.get(
                        "value"
                    )

                    if isinstance(
                        value,
                        str,
                    ):
                        return value.strip()

        if isinstance(
            semantic,
            str,
        ):
            return semantic.strip()

        return None

    # ========================================================
    # SYNONYM EXTRACTION
    # ========================================================

    @staticmethod
    def _extract_synonyms(
        result: dict[str, Any],
    ) -> list[str]:

        values: list[str] = []

        # ----------------------------------------------------
        # Direct synonym fields
        # ----------------------------------------------------

        for key in (
            "synonyms",
            "synonym",
            "Synonyms",
        ):

            value = result.get(
                key
            )

            if isinstance(
                value,
                list,
            ):

                for item in value:

                    if isinstance(
                        item,
                        str,
                    ):
                        values.append(
                            item.strip()
                        )

            elif isinstance(
                value,
                str,
            ):

                values.append(
                    value.strip()
                )

        # ----------------------------------------------------
        # MedGen conceptmeta
        # ----------------------------------------------------

        conceptmeta = result.get(
            "conceptmeta"
        )

        if isinstance(
            conceptmeta,
            str,
        ) and conceptmeta.strip():

            values.extend(
                MedGenClient._parse_conceptmeta(
                    conceptmeta
                )
            )

        # ----------------------------------------------------
        # Remove duplicates
        # ----------------------------------------------------

        output: list[str] = []
        seen: set[str] = set()

        for value in values:

            value = value.strip()

            if not value:
                continue

            key = value.lower()

            if key in seen:
                continue

            seen.add(key)

            output.append(
                value
            )

        return output

    # ========================================================
    # CONCEPTMETA XML PARSER
    # ========================================================

    @staticmethod
    def _parse_conceptmeta(
        conceptmeta: str,
    ) -> list[str]:

        output: list[str] = []

        try:

            decoded = html.unescape(
                conceptmeta
            )

            decoded = (
                decoded
                .replace(
                    "&lt;",
                    "<",
                )
                .replace(
                    "&gt;",
                    ">",
                )
            )

            xml_text = (
                "<ConceptMeta>"
                + decoded
                + "</ConceptMeta>"
            )

            root = ET.fromstring(
                xml_text
            )

            for name in root.findall(
                ".//Name"
            ):

                text = (
                    "".join(
                        name.itertext()
                    )
                    .strip()
                )

                if not text:
                    continue

                term_type = (
                    name.attrib
                    .get(
                        "type",
                        "",
                    )
                    .lower()
                    .strip()
                )

                if term_type in {
                    "syn",
                    "synonym",
                    "alias",
                }:

                    output.append(
                        text
                    )

        except (
            ET.ParseError,
            ValueError,
        ):

            # ------------------------------------------------
            # Fallback regex parser
            # ------------------------------------------------

            pattern = re.compile(
                r"<Name[^>]*"
                r'type=["\']'
                r"(?:syn|synonym|alias)"
                r'["\'][^>]*>'
                r"(.*?)"
                r"</Name>",
                re.IGNORECASE,
            )

            for match in pattern.findall(
                conceptmeta
            ):

                text = html.unescape(
                    match
                ).strip()

                if text:
                    output.append(
                        text
                    )

        return output

    # ========================================================
    # UTILITY
    # ========================================================

    @staticmethod
    def _clean(
        value: str,
    ) -> str:

        value = (
            value
            .lower()
            .strip()
        )

        value = re.sub(
            r"[^a-z0-9\s]+",
            " ",
            value,
        )

        value = re.sub(
            r"\s+",
            " ",
            value,
        )

        return value.strip()

    @staticmethod
    def _string_or_none(
        value: Any,
    ) -> str | None:

        if value is None:
            return None

        value = str(
            value
        ).strip()

        return value or None

    @staticmethod
    def _append_unique(
        destination: list[str],
        values: list[str],
    ) -> None:

        for value in values:

            if value not in destination:
                destination.append(
                    value
                )

    # ========================================================
    # NCBI RATE LIMIT
    # ========================================================

    def _rate_limit(
        self,
    ) -> None:

        # NCBI recommends respecting request limits.
        # API-key requests can generally be faster.

        min_interval = (
            0.35
            if self.api_key
            else 0.5
        )

        now = time.monotonic()

        elapsed = (
            now
            - self.last_request_time
        )

        if elapsed < min_interval:

            time.sleep(
                min_interval
                - elapsed
            )

        self.last_request_time = (
            time.monotonic()
        )