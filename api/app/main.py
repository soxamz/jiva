from __future__ import annotations

from fastapi import FastAPI

from api.app.routers.documents import router as documents_router

app = FastAPI(title="MediKiosk Document AI", version="0.1.0")
app.include_router(documents_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    """Return service health status.

    Args:
        None.

    Returns:
        dict[str, str]: A simple health response.
    """
    return {"status": "ok"}
