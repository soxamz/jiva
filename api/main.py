from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import documents, health, intake, ml3

settings = get_settings()

app = FastAPI(
    title="JivaHQ Clinical Intake API",
    description=(
        "Conversational multimodal history engine: Groq intake turns, "
        "rule-based red flags, deterministic clinical summaries, "
        "Document AI OCR extraction, and ML3 clinical synthesis."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(intake.router)
app.include_router(documents.router)
app.include_router(ml3.router)


def run() -> None:
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        reload_excludes=["runtime/*", "*.json", ".venv/*", "**/__pycache__/*"],
    )


if __name__ == "__main__":
    run()
