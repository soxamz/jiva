from __future__ import annotations

from fastapi import Header, HTTPException


def require_consent(x_consent_token: str | None = Header(default=None, alias="x-consent-token")) -> str:
    """Placeholder consent gate for the Module D integration.

    Args:
        x_consent_token: Consent token supplied in the request headers.

    Returns:
        str: The consent token when present.

    Raises:
        HTTPException: If the request is missing the consent token.
    """
    # TODO(integration): Replace this placeholder with the real Module D consent validation call.
    if not x_consent_token:
        raise HTTPException(status_code=403, detail="Missing consent token")
    return x_consent_token
