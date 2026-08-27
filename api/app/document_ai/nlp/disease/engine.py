from __future__ import annotations

import re

from transformers import (
    AutoModelForTokenClassification,
    AutoTokenizer,
    pipeline,
)

from .schema import (
    DiseaseEntity,
    DiseaseRecognitionResult,
)


MODEL_NAME = "psgrghvuo/pubmedbert_bc5cdr"

DEFAULT_THRESHOLD = 0.70


class DiseaseRecognitionEngine:
    """
    Biomedical disease/entity recognition using a
    pretrained PubMedBERT BC5CDR model.

    This engine does NOT modify OCR text.
    """

    def __init__(
        self,
        model_name: str = MODEL_NAME,
        threshold: float = DEFAULT_THRESHOLD,
        device: int = -1,
    ) -> None:

        self.model_name = model_name

        self.threshold = float(
            threshold
        )

        self.tokenizer = (
            AutoTokenizer.from_pretrained(
                model_name
            )
        )

        self.model = (
            AutoModelForTokenClassification
            .from_pretrained(
                model_name
            )
        )

        self.ner = pipeline(
            "token-classification",
            model=self.model,
            tokenizer=self.tokenizer,
            aggregation_strategy="simple",
            device=device,
        )

    def recognize(
        self,
        text: str,
    ) -> DiseaseRecognitionResult:

        if not text.strip():

            return DiseaseRecognitionResult(
                raw_text=text,
                entities=[],
                confidence=1.0,
                requires_manual_review=False,
                model=self.model_name,
            )

        raw_entities = self.ner(text)

        entities: list[DiseaseEntity] = []

        for item in raw_entities:

            label = str(
                item.get(
                    "entity_group",
                    ""
                )
            )

            score = float(
                item.get(
                    "score",
                    0.0
                )
            )

            entity_text = str(
                item.get(
                    "word",
                    ""
                )
            ).strip()

            if not entity_text:
                continue

            # We only want disease entities.
            if not self._is_disease(label):
                continue

            start = item.get("start")
            end = item.get("end")

            normalized = (
                self._normalize_entity(
                    entity_text
                )
            )

            requires_review = (
                score < self.threshold
            )

            entities.append(
                DiseaseEntity(
                    text=entity_text,
                    normalized_text=normalized,
                    label="Disease",
                    confidence=round(
                        score,
                        4
                    ),
                    start=start,
                    end=end,
                    source_text=text,
                    requires_review=requires_review,
                )
            )

        entities = self._deduplicate(
            entities
        )

        if entities:

            confidence = min(
                entity.confidence
                for entity in entities
            )

        else:

            confidence = 1.0

        requires_review = any(
            entity.requires_review
            for entity in entities
        )

        return DiseaseRecognitionResult(
            raw_text=text,
            entities=entities,
            confidence=round(
                confidence,
                4
            ),
            requires_manual_review=(
                requires_review
            ),
            model=self.model_name,
        )

    @staticmethod
    def _is_disease(
        label: str,
    ) -> bool:

        normalized = label.upper()

        return normalized in {
            "DISEASE",
            "B-DISEASE",
            "I-DISEASE",
        }

    @staticmethod
    def _normalize_entity(
        text: str,
    ) -> str:

        value = text.strip()

        value = re.sub(
            r"\s+",
            " ",
            value,
        )

        return value

    @staticmethod
    def _deduplicate(
        entities: list[DiseaseEntity],
    ) -> list[DiseaseEntity]:

        result: list[DiseaseEntity] = []

        seen: set[
            tuple[str, int | None, int | None]
        ] = set()

        for entity in entities:

            key = (
                entity.normalized_text.lower(),
                entity.start,
                entity.end,
            )

            if key in seen:
                continue

            seen.add(key)

            result.append(entity)

        return result