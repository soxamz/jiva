from __future__ import annotations

from pydantic import BaseModel, Field


class DiseaseEntity(BaseModel):
    text: str
    normalized_text: str
    label: str = "Disease"

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    start: int | None = None
    end: int | None = None

    source_text: str | None = None

    requires_review: bool = False


class DiseaseRecognitionResult(BaseModel):
    raw_text: str

    entities: list[DiseaseEntity] = Field(
        default_factory=list
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    requires_manual_review: bool = False

    model: str | None = None

    def get_diseases(self) -> list[str]:
        return [
            entity.normalized_text
            for entity in self.entities
        ]