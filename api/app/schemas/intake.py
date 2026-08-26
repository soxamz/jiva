from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.schemas.socrates import SocratesSlots


TriageAction = Literal["continue", "bypass_queue", "escalate"]


class RedFlagResult(BaseModel):
    is_emergency: bool = False
    flags: list[str] = Field(default_factory=list)
    matched_rules: list[str] = Field(default_factory=list)
    triage_action: TriageAction = "continue"
    reason: str = ""
    source: Literal["rules", "llm", "merged"] = "rules"


class TranscriptTurn(BaseModel):
    role: Literal["patient", "assistant", "system"]
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    red_flags: RedFlagResult | None = None


class AyushBlock(BaseModel):
    """Dashavidha Pariksha structured capture (draft for clinician verification)."""

    prakriti: str | None = None
    vikriti: str | None = None
    sara: str | None = None
    samhanana: str | None = None
    pramana: str | None = None
    satmya: str | None = None
    sattva: str | None = None
    ahara_shakti: str | None = None
    vyayama_shakti: str | None = None
    vaya: str | None = None
    provisional_notes: str | None = None
    # Legacy aliases kept for older stored sessions
    prakriti_notes: str | None = None
    agni_notes: str | None = None
    ahara_vihara: str | None = None


class PatientHistory(BaseModel):
    chief_complaint: str | None = None
    hpi: SocratesSlots = Field(default_factory=SocratesSlots)
    allergies: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    comorbidities: list[str] = Field(default_factory=list)
    review_of_systems: dict[str, str] = Field(default_factory=dict)
    prior_medications: str | None = None
    prior_consult: str | None = None
    pain_now: str | None = None
    mechanism: str | None = None
    bleeding_now: str | None = None
    consciousness: str | None = None
    blood_thinners: str | None = None
    ayush: AyushBlock | None = None
    source_transcript_refs: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)


class PhysicianSummary(BaseModel):
    en: str
    hi: str
    is_draft: bool = True
    disclaimer: str = (
        "DRAFT for clinician verification only. Not a diagnosis. "
        "Verify against source transcript and documents before clinical use."
    )
    highlights: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)


class SessionState(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    turn_count: int = 0
    chief_complaint: str | None = None
    slots: SocratesSlots = Field(default_factory=SocratesSlots)
    transcript: list[TranscriptTurn] = Field(default_factory=list)
    red_flag_history: list[RedFlagResult] = Field(default_factory=list)
    bypass_queue: bool = False
    complete: bool = False
    # Deprecated: AYUSH is always-on; kept for stored-session compatibility only
    ayush_mode: bool = False
    allergies: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    comorbidities: list[str] = Field(default_factory=list)
    prior_medications: str | None = None
    prior_consult: str | None = None
    pain_now: str | None = None
    mechanism: str | None = None
    bleeding_now: str | None = None
    consciousness: str | None = None
    blood_thinners: str | None = None
    # Compact Dashavidha probe answers (always-on after SOCRATES)
    ayush_vaya: str | None = None
    ayush_prakriti: str | None = None
    ayush_vikriti: str | None = None
    ayush_agni: str | None = None
    ayush_bala: str | None = None
    ayush_manas_vyayam: str | None = None
    ayush: AyushBlock | None = None
    patient_history: PatientHistory | None = None
    physician_summary: PhysicianSummary | None = None
    last_asked_dimension: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SessionCreateResponse(BaseModel):
    session_id: str
    assistant_message: str


class TurnResponse(BaseModel):
    session_id: str
    assistant_message: str
    red_flags: RedFlagResult
    matched_rules: list[str] = Field(default_factory=list)
    socrates_progress: dict[str, bool]
    complete: bool
    severity: int | None = None
    bypass_queue: bool
    turn_count: int
    transcript_preview: str | None = None


class FinalizeResponse(BaseModel):
    session_id: str
    patient_history: PatientHistory
    physician_summary: PhysicianSummary
    bypass_queue: bool
