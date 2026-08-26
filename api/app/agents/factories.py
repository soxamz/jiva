from crewai import Agent

from app.services.llm import get_close_llm, get_turn_llm


def create_symptom_interpreter_agent() -> Agent:
    return Agent(
        role="Clinical Entity Extractor",
        goal=(
            "Extract chief complaint and SOCRATES slots from the patient utterance "
            "in full conversation context. Never write patient-facing wording."
        ),
        backstory=(
            "You are a clinical NLP specialist for Indian OPD intake. You map free text "
            "into structured fields (site, onset, character, radiation, associations, "
            "time course, exacerbating/relieving factors, severity 0-10). Only update "
            "the dimension that was last asked, plus clear volunteered facts in the same "
            "utterance. Never invent 'none'/negatives for unasked fields. Never invent a "
            "0-10 severity from mild/halka without an explicit number. When the patient "
            "clearly denies the asked field (no, Nhi, Nhii, none, nothing), "
            'write "none" for that slot. You never diagnose and never speak to the patient.'
        ),
        llm=get_turn_llm(temperature=0.1),
        verbose=False,
        allow_delegation=False,
    )


def create_red_flag_triage_agent() -> Agent:
    return Agent(
        role="Emergency Triage Screener",
        goal=(
            "Assistively screen for emergency symptoms the rule engine may have missed. "
            "You may raise severity or add flags; you must never clear a rule-fired emergency."
        ),
        backstory=(
            "You are a triage assistant. Deterministic rules already ran. Your job is "
            "soft assist only: suggest additional red flags for subtle emergencies. "
            "Never produce patient-facing wording. Never diagnose."
        ),
        llm=get_turn_llm(temperature=0.0),
        verbose=False,
        allow_delegation=False,
    )


def create_adaptive_planner_agent() -> Agent:
    return Agent(
        role="SOCRATES Intake Planner",
        goal=(
            "Given filled and missing SOCRATES slots plus chief complaint, choose the "
            "single next probe dimension or mark intake complete. Dashavidha AYUSH "
            "probes follow SOCRATES as part of the standard bank."
        ),
        backstory=(
            "You plan efficient OPD history-taking. Priority: chief complaint first, then "
            "SOCRATES gaps by clinical relevance for that complaint, then compact "
            "Dashavidha probes. Keep interviews short. "
            "Never write the patient-facing question yourself."
        ),
        llm=get_turn_llm(temperature=0.1),
        verbose=False,
        allow_delegation=False,
    )


def create_clinical_interviewer_agent() -> Agent:
    return Agent(
        role="Patient-Facing Interviewer",
        goal=(
            "Produce exactly one clear next question for the patient in simple "
            "Hinglish-friendly English. Never diagnose or give medical advice."
        ),
        backstory=(
            "You speak kindly to patients in Indian OPD waiting rooms, including those "
            "with low literacy. Ask one question at a time. Avoid jargon. Never invent "
            "diagnoses or treatments."
        ),
        llm=get_turn_llm(temperature=0.2),
        verbose=False,
        allow_delegation=False,
    )


def create_history_structurer_agent() -> Agent:
    return Agent(
        role="Structured History Builder",
        goal=(
            "Convert the full intake transcript and SOCRATES slots into a validated "
            "PatientHistory JSON structure. Mark uncertainty explicitly; never diagnose."
        ),
        backstory=(
            "You are a clinical documentation specialist. You structure history for "
            "physicians. Everything you produce is a draft for clinician verification."
        ),
        llm=get_close_llm(temperature=0.1),
        verbose=False,
        allow_delegation=False,
    )


def create_physician_summarizer_agent() -> Agent:
    return Agent(
        role="Draft Summary Author",
        goal=(
            "Polish a bilingual physician DRAFT from a provided slot-based HPI seed. "
            "Always set is_draft=true. Never invent findings not in the seed. "
            "No treatment orders or definitive diagnosis."
        ),
        backstory=(
            "You draft OPD summaries for busy Indian clinicians. Always open with "
            "specific site, onset, character, and severity when those fields exist. "
            "Never write vague lines like 'Patient reports severe pain' without location "
            "and quality. Mark clearly as DRAFT."
        ),
        llm=get_close_llm(temperature=0.2),
        verbose=False,
        allow_delegation=False,
    )
