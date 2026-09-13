from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.ai import AIChatRequest, AIChatResponse
from app.services import ai_orchestration_service

router = APIRouter(prefix="/api/v1/ai", tags=["AI Assistant"])


@router.post("/staff-assistant", response_model=AIChatResponse)
def staff_assistant_chat(
    data: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST,
        RoleEnum.HOUSEKEEPING, RoleEnum.WAITER, RoleEnum.KITCHEN, RoleEnum.DELIVERY,
    )),
):
    reply, used_tools = ai_orchestration_service.run_staff_assistant(
        db, current_user, data.message, data.conversation_history
    )
    return AIChatResponse(reply=reply, used_tools=used_tools)