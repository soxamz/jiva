from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, intake

settings = get_settings()

app = FastAPI(
    title="JivaHQ Clinical Intake API",
    description=(
        "Conversational multimodal history engine: Groq TurnCrew + rule red flags + "
        "Gemini CloseCrew."
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
