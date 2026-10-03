import json

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_optional_current_user
from app.models.user import RoleEnum, User
from app.schemas.ai import AIChatRequest, AIChatResponse, AIRoomNarrationRequest
from app.services import ai_orchestration_service, stt_service, tts_service

router = APIRouter(prefix="/api/v1/ai", tags=["AI Assistant"])


def _guest_or_none(current_user: User | None) -> User | None:
    """Staff have their own assistant with their own tools and permissions.
    Anyone else — a signed-in customer or a visitor without an account —
    talks to the guest concierge, and the tool registry decides what each
    of them may see."""
    if current_user is not None and current_user.role != RoleEnum.CUSTOMER:
        return None
    return current_user


@router.post("/customer-assistant", response_model=AIChatResponse)
def customer_assistant_chat(
    data: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    reply, used_tools, room_recommendations = ai_orchestration_service.run_customer_assistant(
        db, _guest_or_none(current_user), data.message, data.conversation_history
    )
    return AIChatResponse(reply=reply, used_tools=used_tools, room_recommendations=room_recommendations)


@router.post("/customer-assistant/stream")
def customer_assistant_chat_stream(
    data: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    """Open to visitors without an account: Alice can describe the hotel,
    the rooms, the menu and real availability to anyone. Only a guest's own
    records need a sign-in, and the tool registry enforces that. Requiring
    an account here is what threw signed-out visitors onto the login page
    in the middle of a conversation."""
    guest = _guest_or_none(current_user)

    def event_source():
        for event in ai_orchestration_service.stream_customer_assistant(
            db, guest, data.message, data.conversation_history
        ):
            yield f"data: {json.dumps(event, default=str)}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")


@router.post("/room-narration")
def room_narration(
    data: AIRoomNarrationRequest,
    current_user: User | None = Depends(get_optional_current_user),
):
    """Alice's speaking voice. A 503 means no voice provider answered; the
    frontend then switches the whole conversation to the browser's voice."""
    audio_bytes, provider = tts_service.synthesize_speech_with_provider(data.text)
    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"X-TTS-Provider": provider},
    )


@router.post("/transcribe")
async def transcribe_speech(
    audio: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_current_user),
):
    """Alice's ears. The page records the guest's voice and posts it here,
    rather than relying on the browser's own voice typing — that depends on
    a service run by the browser's vendor, which fails without warning and
    doesn't exist in every browser."""
    raw = await audio.read()
    text = stt_service.transcribe(raw, audio.filename or "speech.webm")
    return {"text": text}