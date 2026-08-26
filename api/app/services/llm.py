import re


def redact_pii(text: str) -> str:
    """Light DPDP stub: strip Aadhaar-like and phone-like strings before LLM prompts."""
    text = re.sub(r"\b\d{12}\b", "[REDACTED_ID]", text)
    text = re.sub(r"\b\d{10}\b", "[REDACTED_PHONE]", text)
    return re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "[REDACTED_EMAIL]",
        text,
    )
