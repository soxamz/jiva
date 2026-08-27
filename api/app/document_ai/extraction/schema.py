from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Patient(BaseModel):
    name: str | None = None
    age: int | None = None
    sex: str | None = None

    model_config = ConfigDict(extra="allow")


class Encounter(BaseModel):
    department: str | None = None
    visit_type: str | None = None
    collected_on: str | None = None
    reported_on: str | None = None

    model_config = ConfigDict(extra="allow")


class ReportInfo(BaseModel):
    type: str | None = None
    panel: str | None = None
    status: str | None = None

    model_config = ConfigDict(extra="allow")


class ClinicalResult(BaseModel):
    test: str | None = None
    value: float | int | str | None = None
    unit: str | None = None
    reference_range: str | None = None

    model_config = ConfigDict(extra="allow")


class Medication(BaseModel):
    name: str | None = None
    dose: str | None = None
    frequency: str | None = None
    route: str | None = None
    duration: str | None = None
    indication: str | None = None

    model_config = ConfigDict(extra="allow")


class ClinicalItem(BaseModel):
    """
    Used for diagnoses, symptoms, procedures and other
    extracted clinical concepts.

    Mistral may return either:
        {"description": "..."}
    or additional metadata.
    """

    description: str

    model_config = ConfigDict(extra="allow")


class Uncertainty(BaseModel):
    """
    Extraction uncertainty with OCR provenance.
    """

    description: str

    block_indexes: list[int] = Field(
        default_factory=list
    )

    model_config = ConfigDict(extra="allow")


class ClinicalData(BaseModel):
    patient: Patient = Field(
        default_factory=Patient
    )

    encounter: Encounter = Field(
        default_factory=Encounter
    )

    report: ReportInfo = Field(
        default_factory=ReportInfo
    )

    clinical_results: list[ClinicalResult] = Field(
        default_factory=list
    )

    medications: list[Medication] = Field(
        default_factory=list
    )

    diagnoses: list[ClinicalItem] = Field(
        default_factory=list
    )

    symptoms: list[ClinicalItem] = Field(
        default_factory=list
    )

    procedures: list[ClinicalItem] = Field(
        default_factory=list
    )

    clinical_entities: list[ClinicalItem] = Field(
        default_factory=list
    )

    model_config = ConfigDict(extra="allow")


class ExtractionMetadata(BaseModel):
    provider: str | None = None
    model: str | None = None

    extraction_confidence: float | None = None

    requires_manual_review: bool = False

    uncertainties: list[Uncertainty] = Field(
        default_factory=list
    )

    model_config = ConfigDict(extra="allow")


class ABDMExtractionResult(BaseModel):
    """
    Canonical ML2 extraction result.

    This is the structured contract passed from
    ML2 Document AI toward ML3.
    """

    clinical_data: ClinicalData = Field(
        default_factory=ClinicalData
    )

    metadata: ExtractionMetadata = Field(
        default_factory=ExtractionMetadata
    )

    raw_model_output: dict[str, Any] | None = None

    model_config = ConfigDict(
        extra="allow"
    )

    def get_resources(
        self,
        resource_type: str,
    ) -> list[dict[str, Any]]:

        return []