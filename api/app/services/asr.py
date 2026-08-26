from __future__ import annotations

import io
import os

from groq import Groq

from app.config import get_settings


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio via Groq Whisper."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is required for ASR")

    os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)
    client = Groq(api_key=settings.groq_api_key)

    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = filename

    transcription = client.audio.transcriptions.create(
        file=(filename, file_obj),
        model=settings.groq_whisper_model,
        response_format="text",
    )

    if isinstance(transcription, str):
        return transcription.strip()
    text = getattr(transcription, "text", None)
    if text:
        return str(text).strip()
    return str(transcription).strip()
