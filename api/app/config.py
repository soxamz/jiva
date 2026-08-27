from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_API_DIR = Path(__file__).resolve().parents[1]
_PROJECT_DIR = _API_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Vercel injects environment variables at runtime. The files are only
        # convenience fallbacks for local development.
        env_file=(_API_DIR / ".env", _PROJECT_DIR / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    api_host: str = "127.0.0.1"
    api_port: int = 5328

    groq_api_key: str = ""
    gemini_api_key: str = ""

    groq_llm_turn: str = "openai/gpt-oss-20b"
    gemini_llm_close: str = "gemini-3.5-flash-lite"
    groq_whisper_model: str = "whisper-large-v3"
    ai_timeout_ms: int = 15_000

    max_intake_turns: int = 24
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
