from __future__ import annotations

import os

from fastapi import Header, HTTPException


def require_consent(x_consent_token: str | None = Header(default=None, alias="x-consent-token")) -> str:
    """Consent gate for document AI routes.

    When DOCUMENT_AI_REQUIRE_CONSENT=false (default for local patient dashboard),
    a missing token is accepted as "demo-consent".
    """
    require = os.getenv("DOCUMENT_AI_REQUIRE_CONSENT", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    if x_consent_token:
        return x_consent_token

    if not require:
        return "demo-consent"

    raise HTTPException(status_code=403, detail="Missing consent token")
