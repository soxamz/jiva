from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "jivahq-clinical-intake",
        "turn_llm": settings.groq_llm_turn,
        "close_llm": settings.gemini_llm_close,
        "whisper": settings.groq_whisper_model,
        "groq_configured": bool(settings.groq_api_key),
        "gemini_configured": bool(settings.gemini_api_key),
    }


@router.get("/api/hello")
def hello() -> dict:
    return {"message": "JivaHQ Clinical Intake API"}
