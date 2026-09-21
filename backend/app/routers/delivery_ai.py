import uuid

from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.delivery_ai import (
    DeliveryAIRequest,
    DeliveryAIResponse,
)
from app.services import delivery_ai_service


router = APIRouter(
    prefix="/api/v1/ai/delivery",
    tags=["Delivery AI"],
)


@router.post(
    "/menu",
    response_model=DeliveryAIResponse,
)
def menu_recommendation(
    data: DeliveryAIRequest,
    db=Depends(get_db),
    current_user: User = Depends(
        require_roles(RoleEnum.CUSTOMER)
    ),
):
    return delivery_ai_service.recommend_menu(
        db,
        current_user,
        data.message,
    )


@router.post(
    "/order-status/{order_id}",
    response_model=DeliveryAIResponse,
)
def order_status(
    order_id: uuid.UUID,
    db=Depends(get_db),
    current_user: User = Depends(
        require_roles(RoleEnum.CUSTOMER)
    ),
):
    return delivery_ai_service.get_order_status(
        db,
        current_user,
        order_id,
    )


@router.post(
    "/reorder",
    response_model=DeliveryAIResponse,
)
def reorder(
    db=Depends(get_db),
    current_user: User = Depends(
        require_roles(RoleEnum.CUSTOMER)
    ),
):
    return delivery_ai_service.get_last_delivery_order(
        db,
        current_user,
    )