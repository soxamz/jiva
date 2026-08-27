from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Contradiction(BaseModel):
    issue: str = Field(
        description=(
            "The specific contradiction found "
            "(e.g., Patient denies allergies, but OCR shows active EpiPen)."
        )
    )
    severity: str = Field(description="Severity level: 'High', 'Medium', or 'Low'.")
    source_reference: str = Field(
        description=(
            "Tags identifying where the conflicting data came from, "
            "e.g., [Voice_Intake] vs [OCR_Report]."
        )
    )


class SocratesHistory(BaseModel):
    site: Optional[str] = Field(None, description="Location of the symptom.")
    onset: Optional[str] = Field(None, description="When the symptom started.")
    character: Optional[str] = Field(None, description="Type of pain or symptom.")
    radiation: Optional[str] = Field(None, description="Where the symptom radiates to.")
    associated_symptoms: Optional[str] = Field(
        None, description="Other symptoms occurring alongside."
    )
    time_course: Optional[str] = Field(None, description="Pattern of the symptom over time.")
    exacerbating_relieving_factors: Optional[str] = Field(
        None, description="What makes it better or worse."
    )
    severity: Optional[str] = Field(
        None, description="Pain scale or severity metric. (e.g., '10/10' or 'Severe')"
    )


class AyushParameters(BaseModel):
    prakriti: Optional[str] = Field(None, description="Body constitution.")
    vikriti: Optional[str] = Field(None, description="Current imbalance.")
    ahara_vihara: Optional[str] = Field(None, description="Diet and lifestyle notes.")


class AbnormalLab(BaseModel):
    test_name: str = Field(description="Name of the lab test with the abnormal result.")
    flagged_value: str = Field(description="The abnormal value recorded.")
    clinical_significance: str = Field(
        description="Brief note on why this is concerning relative to the patient's symptoms."
    )


class PhysicianDraftSummary(BaseModel):
    chief_complaint: str = Field(description="Primary reason for the visit.")
    socrates_history: SocratesHistory
    ayush_parameters: AyushParameters
    extracted_medications: List[str] = Field(
        default_factory=list,
        description=(
            "List of ALL medications provided in the input data, whether from the "
            "'medications' array or the OCR reports. Do not omit any."
        ),
    )
    detected_contradictions: List[Contradiction] = Field(
        default_factory=list,
        description="List of verified contradictions between spoken intake and uploaded reports.",
    )
    abnormal_lab_flags: List[AbnormalLab] = Field(
        default_factory=list,
        description="List of abnormal lab results identified from the provided lab_reports.",
    )
    doctor_english_summary: str = Field(
        description=(
            "MUST BE FORMATTED IN STRICT MARKDOWN. Use sections: **Chief Complaint:**, "
            "**Presentation:** (Include current medications here!), "
            "**System Warnings:** (include lab anomalies here), and **Action Required:**"
        )
    )
    patient_audio_confirmation: str = Field(
        description=(
            "Simplified regional language summary (Hindi/Hinglish) to be played back to the patient."
        )
    )
