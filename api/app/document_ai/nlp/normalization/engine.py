from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .medgen import MedGenClient


# Abbreviations are intentionally NOT mapped to diseases here.
# They are treated as ambiguous unless surrounding clinical
# context provides enough evidence.
AMBIGUOUS_ABBREVIATIONS = {
    "DM",
    "HTN",
    "H/O",
    "N/H/O",
    "N/H/0",
    "OD",
    "OS",
    "OU",
    "BP",
    "HR",
    "RR",
    "SOB",
    "CP",
}


class MedicalNormalizer:
    """
    Context-aware medical terminology normalization.

    Exact medical terms:
        MedGen exact match -> accepted.

    Abbreviations:
        Never blindly accept a MedGen search result.
        They require contextual verification.

    OCR-corrupted terms:
        Not automatically corrected here.
        A separate OCR-correction/entity-candidate layer
        must provide the candidate before MedGen verification.
    """

    def __init__(
        self,
        client: MedGenClient | None = None,
    ) -> None:

        self.client = (
            client
            or MedGenClient()
        )

    # =========================================================
    # SINGLE TERM
    # =========================================================

    def normalize(
        self,
        term: str,
        context: str | None = None,
    ) -> dict[str, Any]:

        original = (
            term or ""
        ).strip()

        if not original:

            return {
                "original": "",
                "preferred_name": None,
                "concept_id": None,
                "source": None,
                "exact_match": False,
                "confidence": 0.0,
                "matched": False,
                "requires_review": True,
                "match_type": "empty",
                "context_used": False,
            }

        normalized_key = (
            original
            .upper()
            .replace(" ", "")
        )

        # =====================================================
        # AMBIGUOUS ABBREVIATION
        # =====================================================

        if (
            normalized_key
            in AMBIGUOUS_ABBREVIATIONS
        ):

            # We deliberately do NOT send an abbreviation
            # directly to MedGen and accept its first result.

            return self._normalize_abbreviation(
                original,
                context,
            )

        # =====================================================
        # NORMAL MEDICAL TERM
        # =====================================================

        result = self.client.normalize(
            original
        )

        output = asdict(
            result
        )

        output[
            "context_used"
        ] = bool(
            context
            and context.strip()
        )

        return output

    # =========================================================
    # ABBREVIATION
    # =========================================================

    def _normalize_abbreviation(
        self,
        term: str,
        context: str | None,
    ) -> dict[str, Any]:

        # Without context, abbreviation is unsafe.

        if not context:

            return {
                "original": term,
                "preferred_name": None,
                "concept_id": None,
                "source": None,
                "exact_match": False,
                "confidence": 0.0,
                "matched": False,
                "requires_review": True,
                "match_type": (
                    "ambiguous_abbreviation"
                ),
                "context_used": False,
                "reason": (
                    "Ambiguous medical abbreviation "
                    "requires clinical context."
                ),
            }

        context_lower = (
            context.lower()
        )

        # =====================================================
        # IMPORTANT:
        #
        # These are contextual signals, not disease mappings.
        #
        # The abbreviation still has to be verified through
        # MedGen after a candidate has been generated.
        # =====================================================

        candidate_terms: list[str] = []

        if term.upper() == "HTN":

            if any(
                phrase in context_lower
                for phrase in (
                    "hypertension",
                    "blood pressure",
                    "high blood pressure",
                    "hypertensive",
                )
            ):

                candidate_terms.append(
                    "hypertension"
                )

        elif term.upper() == "DM":

            if any(
                phrase in context_lower
                for phrase in (
                    "diabetes",
                    "diabetic",
                    "blood sugar",
                    "glucose",
                    "insulin",
                    "hba1c",
                )
            ):

                candidate_terms.append(
                    "diabetes"
                )

        elif term.upper() == "H/O":

            if any(
                phrase in context_lower
                for phrase in (
                    "history",
                    "past medical history",
                    "medical history",
                )
            ):

                candidate_terms.append(
                    "history"
                )

        elif term.upper() == "N/H/O":

            if any(
                phrase in context_lower
                for phrase in (
                    "no history",
                    "negative history",
                    "past medical history",
                    "medical history",
                )
            ):

                candidate_terms.append(
                    "history"
                )

        # =====================================================
        # No contextual candidate.
        # =====================================================

        if not candidate_terms:

            return {
                "original": term,
                "preferred_name": None,
                "concept_id": None,
                "source": None,
                "exact_match": False,
                "confidence": 0.0,
                "matched": False,
                "requires_review": True,
                "match_type": (
                    "ambiguous_abbreviation"
                ),
                "context_used": True,
                "reason": (
                    "Clinical context did not provide "
                    "a sufficiently strong candidate."
                ),
            }

        # =====================================================
        # VERIFY CANDIDATE THROUGH MEDGEN
        # =====================================================

        verified_candidates = []

        for candidate_term in candidate_terms:

            result = self.client.normalize(
                candidate_term
            )

            if result.matched:

                verified_candidates.append(
                    result
                )

        if not verified_candidates:

            return {
                "original": term,
                "preferred_name": None,
                "concept_id": None,
                "source": None,
                "exact_match": False,
                "confidence": 0.0,
                "matched": False,
                "requires_review": True,
                "match_type": (
                    "context_candidate_unverified"
                ),
                "context_used": True,
                "reason": (
                    "A contextual candidate was found "
                    "but MedGen could not safely verify it."
                ),
            }

        # =====================================================
        # SINGLE VERIFIED CANDIDATE
        # =====================================================

        if len(
            verified_candidates
        ) == 1:

            result = verified_candidates[0]

            output = asdict(
                result
            )

            # Context-derived abbreviation normalization
            # should remain reviewable even if MedGen matched
            # the candidate exactly.
            output[
                "requires_review"
            ] = True

            output[
                "match_type"
            ] = (
                "context_verified_abbreviation"
            )

            output[
                "context_used"
            ] = True

            output[
                "abbreviation"
            ] = term

            output[
                "reason"
            ] = (
                "Abbreviation was resolved using "
                "clinical context and verified by MedGen."
            )

            return output

        # =====================================================
        # MULTIPLE CANDIDATES
        # =====================================================

        return {
            "original": term,
            "preferred_name": None,
            "concept_id": None,
            "source": None,
            "exact_match": False,
            "confidence": 0.0,
            "matched": False,
            "requires_review": True,
            "match_type": (
                "ambiguous_context_candidates"
            ),
            "context_used": True,
            "reason": (
                "Multiple medical interpretations remain "
                "possible; manual review required."
            ),
            "candidates": [
                asdict(candidate)
                for candidate
                in verified_candidates
            ],
        }

    # =========================================================
    # MULTIPLE TERMS
    # =========================================================

    def normalize_many(
        self,
        terms: list[str],
        context: str | None = None,
    ) -> list[dict[str, Any]]:

        return [
            self.normalize(
                term,
                context=context,
            )
            for term in terms
            if term
            and term.strip()
        ]


# =============================================================
# BACKWARD COMPATIBILITY
# =============================================================

TerminologyNormalizationEngine = (
    MedicalNormalizer
)

MedicalTermNormalizer = (
    MedicalNormalizer
)