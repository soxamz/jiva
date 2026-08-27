from __future__ import annotations

import io
import os

from groq import Groq

from app.config import get_settings

# ISO-639-1 codes Whisper accepts for dashboard locales (never "ur" for Hindi).
LOCALE_TO_WHISPER = {
    "en": "en",
    "hi": "hi",
    "bn": "bn",
    "te": "te",
    "ta": "ta",
    # Odia is not reliably supported; omit language and rely on prompt only.
}

_SCRIPT_PROMPTS = {
    "en": (
        "Medical intake. Prefer English or Latin-script Hinglish. "
        "Do not write Urdu or Arabic script."
    ),
    "hi": (
        "चिकित्सा इतिहास। हिंदी देवनागरी लिपि में लिखें। "
        "उर्दू या अरबी लिपि का उपयोग न करें।"
    ),
}


def resolve_whisper_language(locale: str | None) -> str | None:
    if not locale:
        return None
    return LOCALE_TO_WHISPER.get(locale.strip().lower())


def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language: str | None = None,
) -> str:
    """Transcribe audio via Groq Whisper, pinning language/script when known."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is required for ASR")

    os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)
    client = Groq(api_key=settings.groq_api_key)

    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = filename

    whisper_lang = resolve_whisper_language(language) if language else None
    # If caller already passed a Whisper ISO code (e.g. "hi"), keep it.
    if language and whisper_lang is None and len(language.strip()) == 2:
        whisper_lang = language.strip().lower()
        if whisper_lang == "ur":
            # Never pin Urdu for this product — Hindi speakers get Arabic script.
            whisper_lang = "hi"

    prompt_key = whisper_lang if whisper_lang in _SCRIPT_PROMPTS else (
        language.strip().lower() if language else None
    )
    prompt = _SCRIPT_PROMPTS.get(prompt_key or "", None)
    if prompt is None and language and language.strip().lower() == "or":
        prompt = _SCRIPT_PROMPTS["hi"]

    create_kwargs: dict = {
        "file": (filename, file_obj),
        "model": settings.groq_whisper_model,
        "response_format": "text",
    }
    if whisper_lang:
        create_kwargs["language"] = whisper_lang
    if prompt:
        create_kwargs["prompt"] = prompt

    transcription = client.audio.transcriptions.create(**create_kwargs)

    if isinstance(transcription, str):
        return transcription.strip()
    text = getattr(transcription, "text", None)
    if text:
        return str(text).strip()
    return str(transcription).strip()
