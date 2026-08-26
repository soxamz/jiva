import os
import re

from crewai import LLM

from app.config import get_settings

GROQ_OPENAI_BASE = "https://api.groq.com/openai/v1"
GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/"


def _ensure_provider_env() -> None:
    settings = get_settings()
    if settings.groq_api_key:
        os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)
    if settings.gemini_api_key:
        os.environ.setdefault("GEMINI_API_KEY", settings.gemini_api_key)
        os.environ.setdefault("GOOGLE_API_KEY", settings.gemini_api_key)


def get_turn_llm(temperature: float = 0.1) -> LLM:
    """Fast Groq model for per-turn agents via OpenAI-compatible API."""
    _ensure_provider_env()
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is required for TurnCrew")
    # Groq IDs may include slashes (e.g. openai/gpt-oss-20b). CrewAI uses
    # "openai/<api_model>" with our Groq base_url, so nest once:
    # settings "openai/gpt-oss-20b" → CrewAI "openai/openai/gpt-oss-20b" → API "openai/gpt-oss-20b"
    model_name = settings.groq_llm_turn.removeprefix("groq/")
    return LLM(
        model=f"openai/{model_name}",
        api_key=settings.groq_api_key,
        base_url=GROQ_OPENAI_BASE,
        temperature=temperature,
    )


def get_close_llm(temperature: float = 0.1) -> LLM:
    """Gemini CloseCrew via Gemini OpenAI-compatible endpoint."""
    _ensure_provider_env()
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required for CloseCrew")
    model_name = settings.gemini_llm_close.replace("gemini/", "")
    return LLM(
        model=f"openai/{model_name}",
        api_key=settings.gemini_api_key,
        base_url=GEMINI_OPENAI_BASE,
        temperature=temperature,
    )


def redact_pii(text: str) -> str:
    """Light DPDP stub: strip Aadhaar-like and phone-like strings before LLM prompts."""
    text = re.sub(r"\b\d{12}\b", "[REDACTED_ID]", text)
    text = re.sub(r"\b\d{10}\b", "[REDACTED_PHONE]", text)
    text = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "[REDACTED_EMAIL]",
        text,
    )
    return text
