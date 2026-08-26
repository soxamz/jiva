import asyncio

from fastapi import APIRouter, HTTPException, Request

from app.flows.intake_flow import intake_flow
from app.schemas.intake import FinalizeResponse, SessionCreateResponse, SessionState, TurnResponse
from app.schemas.requests import TextTurnRequest

router = APIRouter(prefix="/api/intake", tags=["intake"])


@router.post("/sessions", response_model=SessionCreateResponse)
def create_session() -> SessionCreateResponse:
    return intake_flow.create_session()


@router.get("/sessions/{session_id}", response_model=SessionState)
def get_session(session_id: str) -> SessionState:
    session = intake_flow.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/turn", response_model=TurnResponse)
async def turn(session_id: str, request: Request) -> TurnResponse:
    """Accept JSON {text} or multipart form with text/audio."""
    content_type = request.headers.get("content-type", "")
    try:
        if "application/json" in content_type:
            body = TextTurnRequest.model_validate(await request.json())
            return await asyncio.to_thread(
                intake_flow.process_text_turn, session_id, body.text
            )

        form = await request.form()
        audio = form.get("audio")
        text_value = form.get("text")

        if audio is not None and hasattr(audio, "read"):
            upload = audio  # UploadFile-like
            raw = await upload.read()
            if not raw:
                raise HTTPException(status_code=400, detail="Empty audio upload")
            filename = getattr(upload, "filename", None) or "audio.webm"
            return await asyncio.to_thread(
                intake_flow.process_audio_turn, session_id, raw, filename
            )

        if isinstance(text_value, str) and text_value.strip():
            return await asyncio.to_thread(
                intake_flow.process_text_turn, session_id, text_value
            )

        raise HTTPException(
            status_code=400,
            detail="Provide JSON {text} or multipart text/audio",
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Turn failed: {exc}") from exc


@router.post("/sessions/{session_id}/finalize", response_model=FinalizeResponse)
def finalize(session_id: str) -> FinalizeResponse:
    try:
        return intake_flow.finalize(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Finalize failed: {exc}") from exc
