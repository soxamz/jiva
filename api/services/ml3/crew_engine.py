import os
from crewai import Agent, Task, Crew, Process, LLM
from schemas.clinical_summary import PhysicianDraftSummary
from dotenv import load_dotenv

load_dotenv()

def run_synthesis_crew(clinical_context: str) -> dict:
    
    # 1. Initialize Gemini with minimal sampling overhead
    gemini_llm = LLM(
        model="openai/gemini-3.6-flash",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.0, # Deterministic zero-shot execution
    )

    # 2. Agent 1: Auditor (Enforce single-pass execution)
    auditor = Agent(
        role="Clinical Contradiction Auditor",
        goal="Identify contradictions, red flag omissions, or discrepancies in patient intake data.",
        backstory="You are a clinical data auditor. You output findings directly and concisely in a single pass without unnecessary deliberation.",
        llm=gemini_llm,
        verbose=False,       # Disable terminal logging overhead
        max_iter=1,          # Force single execution (no multi-turn loops)
        max_retry_limit=1,
        allow_delegation=False
    )

    # 3. Agent 2: Synthesizer & Translator (Direct Pydantic generation)
    synthesizer = Agent(
        role="Physician Summary Synthesizer",
        goal="Translate regional terms to clinical English and structure data into the PhysicianDraftSummary schema.",
        backstory="You are an expert bilingual medical scribe. You immediately map findings to standard allopathic terminology and generate structured clinical outputs.",
        llm=gemini_llm,
        verbose=False,
        max_iter=1,
        max_retry_limit=1,
        allow_delegation=False
    )

    # 4. Tasks with direct, unambiguous instructions
    audit_task = Task(
        description=(
            f"Analyze this clinical intake payload:\n{clinical_context}\n\n"
            "List any contradictions between symptoms, history, and red flags. "
            "If none, state 'No contradictions found.'"
        ),
        expected_output="A concise list of identified clinical contradictions.",
        agent=auditor
    )

    synthesis_task = Task(
        description=(
            "Using the clinical payload and audit results:\n"
            "1. Translate colloquial terms/Hinglish (e.g., 'aaj' -> 'today', 'boht painful' -> 'severe pain') to medical English.\n"
            "2. Populate SOCRATES history and extract medications.\n"
            "3. You MUST copy all items from the input medications list into the extracted_medications array. Do not omit any drugs."
            "4. Generate 'doctor_english_summary'. YOU MUST FORMAT THIS AS MARKDOWN. Do not write a dense paragraph. Use this exact structure:\n"
            "   **Chief Complaint:** [1 sentence]\n"
            "   **Presentation:** [Bullet points of key symptoms and timelines]\n"
            "   **⚠️ System Warnings:** [Bullet points of contradictions or missing red flags]\n"
            "   **Action Required:** [1 sentence recommendation]\n"
            "5. Generate 'patient_audio_confirmation' in conversational Hindi/Hinglish."
        ),
        expected_output="JSON strictly adhering to the PhysicianDraftSummary schema, with doctor_english_summary formatted in Markdown.",
        agent=synthesizer,
        output_pydantic=PhysicianDraftSummary
    )

    # 5. Execute sequential pipeline without memory/planning bloat
    crew = Crew(
        agents=[auditor, synthesizer],
        tasks=[audit_task, synthesis_task],
        process=Process.sequential,
        memory=False,
        cache=False,
        verbose=False
    )

    result = crew.kickoff()
    
    return result.pydantic.model_dump() if result.pydantic else result.raw