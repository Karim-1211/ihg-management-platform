from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum, User
from app.schemas.delivery_checkout import (
    DeliveryCheckoutRequest,
    DeliveryCheckoutResponse,
    DeliveryQuoteRequest,
    DeliveryQuoteResponse,
)
from app.services import delivery_checkout_service

router = APIRouter(prefix="/api/v1/delivery", tags=["Delivery Checkout"])


@router.post("/quote", response_model=DeliveryQuoteResponse)
def quote_delivery(data: DeliveryQuoteRequest, db: Session = Depends(get_db)):
    """Public — prices are public, and guests can price a basket before signing in."""
    return delivery_checkout_service.quote_delivery(db, data)


@router.post("/checkout", response_model=DeliveryCheckoutResponse, status_code=201)
def checkout_delivery(
    data: DeliveryCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.CUSTOMER)),
):
    return delivery_checkout_service.checkout_delivery(db, current_user, data)