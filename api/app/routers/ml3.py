from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ml3.crew_engine import run_synthesis_crew
from app.services.ml3.red_flag_detector import detect_emergencies

router = APIRouter(prefix="/api/ml3", tags=["ml3"])


class ClinicalResultItem(BaseModel):
    test: str | None = None
    value: Any = None
    unit: str | None = None
    reference_range: str | None = None


class LabReportPanel(BaseModel):
    panel: str | None = None
    clinical_results: list[ClinicalResultItem] = Field(default_factory=list)


class SynthesizeRequest(BaseModel):
    patient_id: str | None = None
    intake_session_id: str | None = None
    chief_complaint: str | None = None
    hpi: dict[str, Any] | None = None
    allergies: list[Any] = Field(default_factory=list)
    medications: list[Any] = Field(default_factory=list)
    comorbidities: list[Any] = Field(default_factory=list)
    review_of_systems: dict[str, Any] | None = None
    ayush: dict[str, Any] | None = None
    source_transcript_refs: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    lab_reports: list[LabReportPanel | dict[str, Any]] = Field(default_factory=list)
    ocr_documents: list[dict[str, Any]] = Field(default_factory=list)
    voice_transcript: str | None = None
    ocr_data: Any = None

    model_config = {"extra": "allow"}


def _transcript_blob(body: SynthesizeRequest) -> str:
    parts = list(body.source_transcript_refs)
    if body.voice_transcript:
        parts.append(body.voice_transcript)
    if body.chief_complaint:
        parts.append(body.chief_complaint)
    return " ".join(str(p) for p in parts if p)


@router.post("/synthesize")
async def synthesize_clinical_summary(body: SynthesizeRequest) -> dict[str, Any]:
    """Fuse ML1 intake + ML2 OCR into a physician-ready draft summary."""
    triage = detect_emergencies(_transcript_blob(body))
    payload = body.model_dump(exclude_none=False)

    try:
        summary = run_synthesis_crew(payload)
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "ML3 dependencies are not installed. "
                "Use Python 3.10-3.13 and install api/requirements-ml3.txt."
            ),
        ) from exc
    except Exception as exc:  # noqa: BLE001 — surface synthesis failures to the client
        raise HTTPException(status_code=500, detail=f"ML3 synthesis failed: {exc}") from exc

    if isinstance(summary, str):
        try:
            summary = json.loads(summary)
        except json.JSONDecodeError:
            summary = {"doctor_english_summary": summary}

    if not isinstance(summary, dict):
        summary = {"raw": summary}

    return {
        **summary,
        "triage_alert": triage.get("triage_alert", False),
        "triage_reasons": triage.get("reasons", []),
        "triage_action": triage.get("action"),
        "patient_id": body.patient_id,
        "intake_session_id": body.intake_session_id,
    }
