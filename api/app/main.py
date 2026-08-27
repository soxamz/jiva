"""Optional local harness for Document AI only.

Production / `bun dev` uses `api/main.py` (intake + documents).
"""

from __future__ import annotations

from fastapi import FastAPI

from app.routers.documents import router as documents_router

app = FastAPI(title="JivaHQ Document AI (harness)", version="0.1.0")
app.include_router(documents_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
