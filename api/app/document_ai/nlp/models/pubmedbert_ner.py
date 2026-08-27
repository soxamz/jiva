from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from transformers import (
    AutoModelForTokenClassification,
    AutoTokenizer,
    pipeline,
)


MODEL_NAME = (
    "psgrghvuo/pubmedbert_bc5cdr"
)


@dataclass
class BiomedicalEntity:
    text: str
    label: str
    score: float
    start: int | None = None
    end: int | None = None

    def model_dump(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "label": self.label,
            "score": self.score,
            "start": self.start,
            "end": self.end,
        }


class PubMedBERTNER:

    def __init__(
        self,
        model_name: str = MODEL_NAME,
        device: int = -1,
    ) -> None:

        self.model_name = model_name

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

        self.pipeline = pipeline(
            "token-classification",
            model=self.model,
            tokenizer=self.tokenizer,
            aggregation_strategy="simple",
            device=device,
        )

    def analyze(
        self,
        text: str,
    ) -> list[BiomedicalEntity]:

        if not text.strip():
            return []

        results = self.pipeline(text)

        entities: list[
            BiomedicalEntity
        ] = []

        for item in results:

            entities.append(
                BiomedicalEntity(
                    text=str(
                        item.get("word", "")
                    ).strip(),
                    label=str(
                        item.get(
                            "entity_group",
                            "UNKNOWN",
                        )
                    ),
                    score=float(
                        item.get(
                            "score",
                            0.0,
                        )
                    ),
                    start=item.get("start"),
                    end=item.get("end"),
                )
            )

        return entities