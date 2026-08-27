from __future__ import annotations

import os
import re
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

from .classification.doc_classifier import classify_document
from .confidence.engine import ConfidenceEngine
from .extraction.factory import get_extraction_engine
from .nlp.correction import MedicalOCRCorrectionEngine
from .ocr.factory import get_ocr_engine


class DocumentAIPipeline:
    """
    ML2 Document AI pipeline.

    Image
        ↓
    OCR
        ↓
    OCR correction
        ↓
    Document classification
        ↓
    Clinical extraction
        ↓
    Confidence scoring
        ↓
    Structured JSON
        ↓
    ML3
    """

    def __init__(
        self,
        *,
        ocr_provider: str | None = None,
        correction_provider: str | None = None,
        extraction_provider: str | None = None,
    ) -> None:

        self.ocr_provider_name = (
            ocr_provider
            or os.getenv(
                "OCR_PROVIDER",
                "mistral",
            )
        ).strip().lower()

        self.correction_provider_name = (
            correction_provider
            or os.getenv(
                "CORRECTION_PROVIDER",
                "groq",
            )
        ).strip().lower()

        self.extraction_provider_name = (
            extraction_provider
            or os.getenv(
                "EXTRACTION_PROVIDER",
                "mistral",
            )
        ).strip().lower()

        # ----------------------------------------------------
        # OCR
        # ----------------------------------------------------

        self.ocr = get_ocr_engine(
            self.ocr_provider_name
        )

        # ----------------------------------------------------
        # Correction
        # ----------------------------------------------------

        previous_correction_provider = os.getenv(
            "CORRECTION_PROVIDER"
        )

        os.environ["CORRECTION_PROVIDER"] = (
            self.correction_provider_name
        )

        try:
            self.correction = (
                MedicalOCRCorrectionEngine()
            )
        finally:
            if previous_correction_provider is None:
                os.environ.pop(
                    "CORRECTION_PROVIDER",
                    None,
                )
            else:
                os.environ[
                    "CORRECTION_PROVIDER"
                ] = previous_correction_provider

        # ----------------------------------------------------
        # Extraction
        # ----------------------------------------------------

        self.extraction = (
            get_extraction_engine(
                self.extraction_provider_name
            )
        )

        # ----------------------------------------------------
        # Confidence
        # ----------------------------------------------------

        self.confidence = ConfidenceEngine()

    # ========================================================
    # MAIN PIPELINE
    # ========================================================

    def process(
        self,
        image_path: str | Path,
    ) -> dict[str, Any]:

        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError(
                f"Document not found: {image_path}"
            )

        # ====================================================
        # 1. OCR
        # ====================================================

        ocr_result = self.ocr.process(
            str(image_path)
        )

        raw_text = self._get(
            ocr_result,
            "text",
            "",
        )

        if not raw_text:
            raise RuntimeError(
                "OCR returned empty text."
            )

        ocr_confidence = (
            self._normalise_confidence(
                self._get(
                    ocr_result,
                    "confidence",
                    0.0,
                )
            )
        )

        ocr_blocks = self._get(
            ocr_result,
            "blocks",
            [],
        )

        if not isinstance(
            ocr_blocks,
            list,
        ):
            ocr_blocks = []

        # ====================================================
        # 2. OCR CORRECTION
        # ====================================================

        correction_result = (
            self.correction.correct(
                raw_text
            )
        )

        corrected_text = self._get(
            correction_result,
            "corrected_text",
            raw_text,
        )

        if not corrected_text:
            corrected_text = raw_text

        correction_confidence = (
            self._normalise_confidence(
                self._get(
                    correction_result,
                    "confidence",
                    1.0,
                ),
                default=1.0,
            )
        )

        # ----------------------------------------------------
        # Clean correction history
        # ----------------------------------------------------

        raw_corrections = (
            self._get(
                correction_result,
                "corrections",
                [],
            )
            or []
        )

        correction_history: list[
            dict[str, Any]
        ] = []

        for item in raw_corrections:

            serialized = self._serialize(
                item
            )

            if not isinstance(
                serialized,
                dict,
            ):
                continue

            raw_correction = serialized.get(
                "raw_text"
            )

            corrected_correction = (
                serialized.get(
                    "corrected_text"
                )
            )

            # Ignore malformed records.
            if (
                not raw_correction
                or not corrected_correction
            ):
                continue

            correction_history.append(
                {
                    "raw_text": str(
                        raw_correction
                    ),
                    "corrected_text": str(
                        corrected_correction
                    ),
                    "confidence": (
                        self._normalise_confidence(
                            serialized.get(
                                "confidence",
                                0.0,
                            )
                        )
                    ),
                    "accepted": bool(
                        serialized.get(
                            "accepted",
                            False,
                        )
                    ),
                    "reason": str(
                        serialized.get(
                            "reason",
                            "",
                        )
                    ),
                }
            )

        # ----------------------------------------------------
        # Deduplicate corrections
        # ----------------------------------------------------

        unique_corrections: list[
            dict[str, Any]
        ] = []

        seen_corrections: set[
            tuple[str, str]
        ] = set()

        for correction in correction_history:

            key = (
                correction["raw_text"],
                correction["corrected_text"],
            )

            if key in seen_corrections:
                continue

            seen_corrections.add(
                key
            )

            unique_corrections.append(
                correction
            )

        correction_history = (
            unique_corrections
        )

        # ====================================================
        # 3. DOCUMENT CLASSIFICATION
        # ====================================================

        document_type = classify_document(
            corrected_text
        )

        # ====================================================
        # 4. CLINICAL EXTRACTION
        # ====================================================

        extraction_result = (
            self._run_extraction(
                corrected_text=corrected_text,
                raw_text=raw_text,
                ocr_blocks=ocr_blocks,
                corrections=correction_history,
            )
        )

        clinical_data = self._get(
            extraction_result,
            "clinical_data",
            {},
        )

        clinical_data = self._serialize(
            clinical_data
        )

        if not isinstance(
            clinical_data,
            dict,
        ):
            clinical_data = {}

        extraction_metadata = self._get(
            extraction_result,
            "metadata",
            {},
        )

        extraction_metadata = self._serialize(
            extraction_metadata
        )

        if not isinstance(
            extraction_metadata,
            dict,
        ):
            extraction_metadata = {}

        # ----------------------------------------------------
        # Extraction-level uncertainties.
        #
        # These record WHY content was dropped or left unplaced
        # (ungrounded item removed, service-catalog boilerplate
        # filtered, a value whose role could not be determined).
        # They are surfaced in the final ML2 JSON rather than being
        # discarded, so a reviewer can see what the system chose not
        # to assert instead of only seeing a review flag.
        # ----------------------------------------------------

        extraction_uncertainties: list[
            dict[str, Any]
        ] = []

        for item in (
            extraction_metadata.get(
                "uncertainties"
            )
            or []
        ):

            serialized = self._serialize(
                item
            )

            if isinstance(
                serialized,
                dict,
            ):

                description = serialized.get(
                    "description"
                )

                if not description:
                    continue

                extraction_uncertainties.append(
                    {
                        "description": str(
                            description
                        ),
                        "source_blocks": (
                            serialized.get(
                                "source_blocks"
                            )
                            or []
                        ),
                    }
                )

            elif serialized:

                extraction_uncertainties.append(
                    {
                        "description": str(
                            serialized
                        ),
                        "source_blocks": [],
                    }
                )

        (
            extraction_confidence,
            extraction_was_empty,
        ) = (
            self._resolve_extraction_confidence(
                extraction_metadata,
                clinical_data,
            )
        )

        # ----------------------------------------------------
        # Ground final structured clinical content against the
        # corrected OCR. This is a final pipeline-level safety
        # net even when a provider does not perform grounding.
        # ----------------------------------------------------

        (
            clinical_data,
            grounding_changed,
        ) = self._ground_clinical_data(
            clinical_data,
            corrected_text,
        )

        extraction_review = bool(
            extraction_metadata.get(
                "requires_manual_review",
                False,
            )
        )

        # An extraction that produced no clinical content at all is
        # not a hard failure (the document may genuinely be free of
        # clinical information), but per design principle 14 it must
        # never be treated as confidently "clean" -- it always needs
        # a human to confirm nothing was missed.
        extraction_review = (
            extraction_review
            or extraction_was_empty
        )

        # ----------------------------------------------------
        # An ambiguous clinical entity (non-null "uncertainty")
        # must be able to independently trigger manual review,
        # regardless of what the extraction provider itself
        # reported for `requires_manual_review`. This is a
        # provider-agnostic safety net -- see FINAL ISSUE #3.
        # It never lowers confidence; it only affects the review
        # flag below.
        # ----------------------------------------------------

        entities_for_review_check = clinical_data.get(
            "clinical_entities",
            [],
        )

        if not isinstance(
            entities_for_review_check,
            list,
        ):
            entities_for_review_check = []

        entity_uncertainty_present = any(
            isinstance(entity, dict)
            and entity.get("uncertainty")
            for entity in entities_for_review_check
        )

        # ====================================================
        # 5. OCR QUALITY
        # ====================================================
        #
        # Missing block confidence is NOT confidence 0.
        #
        # Only explicitly provided low-confidence blocks
        # are reported.
        # ====================================================

        low_confidence_regions: list[
            dict[str, Any]
        ] = []

        for block in ocr_blocks:

            raw_block_confidence = self._get(
                block,
                "confidence",
                None,
            )

            if raw_block_confidence is None:
                continue

            try:
                block_confidence = float(
                    raw_block_confidence
                )
            except (
                TypeError,
                ValueError,
            ):
                continue

            if block_confidence > 1.0:
                block_confidence /= 100.0

            if block_confidence >= 0.70:
                continue

            content = (
                self._get(
                    block,
                    "content",
                    None,
                )
                or self._get(
                    block,
                    "text",
                    "",
                )
            )

            if not content:
                continue

            low_confidence_regions.append(
                {
                    "content": str(
                        content
                    ),
                    "confidence": (
                        block_confidence
                    ),
                }
            )

        # ====================================================
        # 6. FINAL CONFIDENCE
        # ====================================================

        final_confidence = (
            self._calculate_final_confidence(
                ocr_confidence=(
                    ocr_confidence
                ),
                correction_confidence=(
                    correction_confidence
                ),
                extraction_confidence=(
                    extraction_confidence
                ),
            )
        )

        # ====================================================
        # 7. MANUAL REVIEW
        # ====================================================

        correction_review = bool(
            self._get(
                correction_result,
                "requires_review",
                False,
            )
        )

        # The confidence threshold comes from the already-configured
        # ConfidenceEngine (MANUAL_REVIEW_THRESHOLD, default 0.70)
        # rather than a second hardcoded literal, so there is exactly
        # one source of truth for it.
        #
        # Every other clause below is an INDEPENDENT trigger: any one
        # of them forces review even when the blended confidence
        # clears the threshold. A high score must never be able to
        # mask a known problem.
        manual_review_required = (
            final_confidence
            < self.confidence.manual_review_threshold
            or extraction_review
            or correction_review
            or grounding_changed
            or entity_uncertainty_present
            or bool(
                low_confidence_regions
            )
        )

        # ====================================================
        # 8. STRUCTURED DATA
        # ====================================================

        patient = self._dict(
            clinical_data.get(
                "patient",
                {},
            )
        )

        encounter = self._dict(
            clinical_data.get(
                "encounter",
                {},
            )
        )

        report = self._dict(
            clinical_data.get(
                "report",
                {},
            )
        )

        clinical_results = (
            self._ensure_list(
                clinical_data.get(
                    "clinical_results",
                    [],
                )
            )
        )

        medications = (
            self._ensure_list(
                clinical_data.get(
                    "medications",
                    [],
                )
            )
        )

        diagnoses = (
            self._ensure_list(
                clinical_data.get(
                    "diagnoses",
                    [],
                )
            )
        )

        symptoms = (
            self._ensure_list(
                clinical_data.get(
                    "symptoms",
                    [],
                )
            )
        )

        procedures = (
            self._ensure_list(
                clinical_data.get(
                    "procedures",
                    [],
                )
            )
        )

        clinical_entities = (
            self._ensure_list(
                clinical_data.get(
                    "clinical_entities",
                    [],
                )
            )
        )

        ayush_parameters = self._dict(
            clinical_data.get(
                "ayush_parameters",
                {},
            )
        )

        # ====================================================
        # 9. FINAL ML2 JSON
        # ====================================================

        return {
            "document_id": image_path.stem,

            "source": {
                "image": str(
                    image_path
                ),
                "provider": self._get(
                    ocr_result,
                    "provider",
                    self.ocr_provider_name,
                ),
                "model": self._get(
                    ocr_result,
                    "model",
                    "mistral-ocr-latest",
                ),
                "ocr_confidence": (
                    ocr_confidence
                ),
                "page_count": self._get(
                    ocr_result,
                    "page_count",
                    1,
                ),
            },

            "document_type": (
                document_type
            ),

            "patient": patient,

            "encounter": encounter,

            "report": report,

            "clinical_results": (
                clinical_results
            ),

            "medications": medications,

            "diagnoses": diagnoses,

            "symptoms": symptoms,

            "procedures": procedures,

            "clinical_entities": (
                clinical_entities
            ),

            "ayush_parameters": (
                ayush_parameters
            ),

            # Why content was dropped or left unplaced. Never
            # suppressed: an empty list means nothing was omitted.
            "uncertainties": (
                extraction_uncertainties
            ),

            "ocr_quality": {
                "low_confidence_regions": (
                    low_confidence_regions
                )
            },

            "confidence": {
                "ocr": ocr_confidence,
                "correction": (
                    correction_confidence
                ),
                "extraction": (
                    extraction_confidence
                ),
                "final": (
                    final_confidence
                ),
                "manual_review_required": (
                    manual_review_required
                ),
            },

            "provenance": {
                "correction_provider": (
                    self._get(
                        correction_result,
                        "provider",
                        self.correction_provider_name,
                    )
                ),
                "correction_model": (
                    self._get(
                        correction_result,
                        "model",
                        "",
                    )
                ),
                "extraction_provider": (
                    extraction_metadata.get("provider")
                    or getattr(
                        self.extraction,
                        "provider",
                        None,
                    )
                    or self.extraction_provider_name
                ),
                "extraction_model": (
                    extraction_metadata.get("model")
                    or getattr(
                        self.extraction,
                        "model",
                        None,
                    )
                    or os.getenv(
                        "MISTRAL_EXTRACTION_MODEL",
                        "ministral-14b-latest",
                    )
                ),
            },

            "correction_history": (
                correction_history
            ),

            # Keep original and corrected OCR for
            # provenance/debugging. ML3 can ignore them.
            "raw_ocr_text": raw_text,

            "corrected_ocr_text": (
                corrected_text
            ),
        }

    # ========================================================
    # EXTRACTION COMPATIBILITY
    # ========================================================

    def _run_extraction(
        self,
        *,
        corrected_text: str,
        raw_text: str,
        ocr_blocks: list[Any],
        corrections: list[Any],
    ) -> Any:

        try:

            return self.extraction.extract(
                corrected_text,
                ocr_blocks=ocr_blocks,
                raw_ocr_text=raw_text,
                corrections=corrections,
            )

        except TypeError as error:

            message = str(
                error
            ).lower()

            signature_error = (
                "unexpected keyword" in message
                or "positional argument" in message
                or "takes" in message
            )

            if not signature_error:
                raise

            return self.extraction.extract(
                corrected_text
            )

    # ========================================================
    # EXTRACTION GROUNDING
    # ========================================================
    #
    # NOTE: this mirrors the token-overlap algorithm used in
    # extraction/mistral.py (`_grounded_in_ocr`). It is kept as a
    # separate, provider-agnostic implementation deliberately: this
    # runs regardless of which extraction provider produced the
    # data, so it is the pipeline's own safety net rather than a
    # provider-specific concern. Both implementations must stay
    # behaviourally identical -- if you change the matching rule
    # here, change it in mistral.py too.
    # ========================================================

    # Generic hospital/service-catalog boilerplate that must never
    # become a patient clinical entity, even when it is textually
    # present in the OCR (e.g. inside an ad or a service menu).
    # Deliberately narrow: only unambiguous contact/marketing/URL
    # patterns. Never used against symptoms/diagnoses/procedures,
    # since real clinical language should never match these.
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

    @staticmethod
    def _grounding_text(value: Any) -> str:
        """Normalize text for conservative OCR grounding."""
        if value is None:
            return ""
        text = str(value).lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @classmethod
    def _is_grounded(
        cls,
        value: Any,
        corrected_text: str,
    ) -> bool:
        """
        Check whether an extracted clinical value is supported
        by the corrected OCR.

        This is deliberately conservative. We do not require an
        exact phrase for multi-token values because OCR formatting
        can insert punctuation or whitespace.
        """
        needle = cls._grounding_text(value)
        haystack = cls._grounding_text(corrected_text)

        if not needle or not haystack:
            return False

        if needle in haystack:
            return True

        tokens = [
            token
            for token in needle.split()
            if len(token) >= 3
        ]

        if not tokens:
            return False

        hay_tokens = set(haystack.split())

        if len(tokens) == 1:
            return tokens[0] in hay_tokens

        matched = sum(
            token in hay_tokens
            for token in tokens
        )

        return matched >= max(
            1,
            len(tokens) - 1,
        )

    @classmethod
    def _ground_clinical_data(
        cls,
        clinical_data: dict[str, Any],
        corrected_text: str,
    ) -> tuple[dict[str, Any], bool]:
        """
        Remove clearly hallucinated clinical items.

        We only ground fields whose values represent explicit
        clinical observations. Patient/encounter/report metadata
        is left untouched because labels and values may be separated
        in OCR layout.
        """
        changed = False

        # Medications: ground by medication name.
        medications = cls._ensure_list(
            clinical_data.get("medications", [])
        )
        grounded_medications = []

        for medication in medications:
            if not isinstance(medication, dict):
                continue

            name = medication.get("name")

            if name and cls._is_grounded(
                name,
                corrected_text,
            ):
                grounded_medications.append(
                    medication
                )
            else:
                changed = True

        clinical_data["medications"] = (
            grounded_medications
        )

        # Symptoms, diagnoses and procedures generally use description.
        for field in (
            "symptoms",
            "diagnoses",
            "procedures",
        ):
            values = cls._ensure_list(
                clinical_data.get(field, [])
            )

            grounded = []

            for item in values:
                if not isinstance(item, dict):
                    continue

                description = (
                    item.get("description")
                    or item.get("name")
                    or item.get("value")
                )

                if description and cls._is_grounded(
                    description,
                    corrected_text,
                ):
                    grounded.append(item)
                else:
                    changed = True

            clinical_data[field] = grounded

        # Clinical entities are the highest-risk hallucination field.
        # They also get an extra boilerplate check: generic hospital
        # service/ad/contact text can be textually present in the OCR
        # (so it would pass plain grounding) without being genuine
        # patient clinical information.
        entities = cls._ensure_list(
            clinical_data.get(
                "clinical_entities",
                [],
            )
        )

        grounded_entities = []

        for entity in entities:
            if not isinstance(entity, dict):
                continue

            description = (
                entity.get("description")
                or entity.get("value")
                or entity.get("name")
            )

            if (
                description
                and cls._is_grounded(
                    description,
                    corrected_text,
                )
                and not cls._looks_like_boilerplate(
                    description
                )
            ):
                grounded_entities.append(entity)
            else:
                changed = True

        clinical_data["clinical_entities"] = (
            grounded_entities
        )

        return clinical_data, changed

    # ========================================================
    # EXTRACTION CONFIDENCE / PROVENANCE
    # ========================================================

    def _resolve_extraction_confidence(
        self,
        extraction_metadata: dict[str, Any],
        clinical_data: dict[str, Any],
    ) -> tuple[float, bool]:
        """
        Resolve extraction confidence without turning a successful
        structured extraction into 0.0 merely because the provider
        omitted the field.

        Provider-reported confidence remains authoritative when it
        is present and > 0. A conservative structural fallback is
        used only when the provider omitted/zeroed the value.

        Returns a (confidence, extraction_was_empty) tuple. The
        second value is True only when we fell back to the
        "empty but valid extraction" case, so the caller can force
        manual review even if the blended final confidence happens
        to clear the 0.70 threshold.
        """
        raw = extraction_metadata.get(
            "extraction_confidence"
        )

        try:
            confidence = float(raw)
        except (
            TypeError,
            ValueError,
        ):
            confidence = 0.0

        if confidence > 1.0 and confidence <= 100.0:
            confidence /= 100.0

        if confidence > 0.0:
            return (
                self._normalise_confidence(
                    confidence
                ),
                False,
            )

        # Successful schema validation with actual extracted
        # clinical content is not an extraction failure.
        extracted_count = 0

        for field in (
            "clinical_results",
            "medications",
            "diagnoses",
            "symptoms",
            "procedures",
            "clinical_entities",
        ):
            value = clinical_data.get(field)
            if isinstance(value, list):
                extracted_count += len(value)

        if extracted_count > 0:
            return 0.75, False

        # Empty but valid extraction is still a successful model
        # response, but it must always be reviewed rather than
        # silently trusted -- an empty result could mean either a
        # genuinely non-clinical document, or a missed extraction.
        return 0.50, True

    # ========================================================
    # FINAL CONFIDENCE
    # ========================================================

    @staticmethod
    def _calculate_final_confidence(
        *,
        ocr_confidence: float,
        correction_confidence: float,
        extraction_confidence: float,
    ) -> float:
        """
        Blend the three pipeline-stage confidences into the final
        score.

        These weights are intentionally NOT the ConfidenceEngine
        weights (CONFIDENCE_WEIGHT_OCR / _EXTRACTION / _GROUNDING).
        They measure different things: ConfidenceEngine blends
        ocr / extraction / GROUNDING, whereas this pipeline has a
        real OCR-CORRECTION stage whose confidence must be carried
        into the final score. Correction confidence is deliberately
        given the smallest share (0.20) because a cautious
        correction pass -- one that declines to guess an ambiguous
        drug name and therefore reports low confidence -- should
        depress the final score enough to require review without
        collapsing it, while OCR and extraction quality remain
        dominant.

        Low correction confidence is never smoothed away here, and
        this function never raises a score: an uncertain document
        stays uncertain. Do not "fix" a low final score by
        reweighting -- fix the stage that is actually uncertain.
        """

        score = (
            ocr_confidence * 0.30
            + correction_confidence * 0.20
            + extraction_confidence * 0.50
        )

        return round(
            max(
                0.0,
                min(
                    1.0,
                    score,
                ),
            ),
            4,
        )

    # ========================================================
    # HELPERS
    # ========================================================

    @staticmethod
    def _get(
        obj: Any,
        key: str,
        default: Any = None,
    ) -> Any:

        if obj is None:
            return default

        if isinstance(
            obj,
            dict,
        ):
            return obj.get(
                key,
                default,
            )

        return getattr(
            obj,
            key,
            default,
        )

    @staticmethod
    def _dict(
        value: Any,
    ) -> dict[str, Any]:

        if value is None:
            return {}

        if isinstance(
            value,
            dict,
        ):
            return value

        serialized = (
            DocumentAIPipeline._serialize(
                value
            )
        )

        if isinstance(
            serialized,
            dict,
        ):
            return serialized

        return {}

    @staticmethod
    def _ensure_list(
        value: Any,
    ) -> list[Any]:

        if value is None:
            return []

        if isinstance(
            value,
            list,
        ):
            return [
                DocumentAIPipeline._serialize(
                    item
                )
                for item in value
            ]

        return [
            DocumentAIPipeline._serialize(
                value
            )
        ]

    @staticmethod
    def _normalise_confidence(
        value: Any,
        default: float = 0.0,
    ) -> float:

        try:
            value = float(
                value
            )
        except (
            TypeError,
            ValueError,
        ):
            return default

        if value > 1.0 and value <= 100.0:
            value /= 100.0

        return max(
            0.0,
            min(
                1.0,
                value,
            ),
        )

    @staticmethod
    def _serialize(
        value: Any,
    ) -> Any:

        if value is None:
            return None

        if hasattr(
            value,
            "model_dump",
        ):
            return value.model_dump()

        if is_dataclass(
            value
        ):
            return asdict(
                value
            )

        if isinstance(
            value,
            list,
        ):
            return [
                DocumentAIPipeline._serialize(
                    item
                )
                for item in value
            ]

        if isinstance(
            value,
            tuple,
        ):
            return [
                DocumentAIPipeline._serialize(
                    item
                )
                for item in value
            ]

        if isinstance(
            value,
            dict,
        ):
            return {
                key: (
                    DocumentAIPipeline._serialize(
                        item
                    )
                )
                for key, item in value.items()
            }

        return value