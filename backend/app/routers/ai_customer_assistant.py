import json

from fastapi import APIRouter, Depends
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.ai import AIChatRequest, AIChatResponse, AIRoomNarrationRequest
from app.services import ai_orchestration_service, tts_service

router = APIRouter(prefix="/api/v1/ai", tags=["AI Assistant"])


@router.post("/customer-assistant", response_model=AIChatResponse)
def customer_assistant_chat(
    data: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.CUSTOMER)),
):
    reply, used_tools, room_recommendations = ai_orchestration_service.run_customer_assistant(
        db, current_user, data.message, data.conversation_history
    )
    return AIChatResponse(reply=reply, used_tools=used_tools, room_recommendations=room_recommendations)


@router.post("/customer-assistant/stream")
def customer_assistant_chat_stream(
    data: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.CUSTOMER)),
):
    def event_source():
        for event in ai_orchestration_service.stream_customer_assistant(
            db, current_user, data.message, data.conversation_history
        ):
            yield f"data: {json.dumps(event, default=str)}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")


@router.post("/room-narration")
def room_narration(
    data: AIRoomNarrationRequest,
    current_user: User = Depends(require_roles(RoleEnum.CUSTOMER)),
):
    audio_bytes = tts_service.synthesize_speech(data.text)
    return Response(content=audio_bytes, media_type="audio/wav")