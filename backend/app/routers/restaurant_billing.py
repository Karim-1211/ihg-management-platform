import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.restaurant_billing import (
    RestaurantInvoiceResponse, RestaurantPaymentCreate, RestaurantPaymentResponse,
)
from app.services import restaurant_billing_service

router = APIRouter(prefix="/api/v1", tags=["Restaurant Billing"])


@router.get("/restaurant-invoices/my", response_model=list[RestaurantInvoiceResponse])
def my_restaurant_invoices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return restaurant_billing_service.list_my_invoices(db, current_user.id)


@router.get("/restaurant-invoices/order/{order_id}", response_model=RestaurantInvoiceResponse)
def invoice_for_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return restaurant_billing_service.get_invoice_for_order(db, order_id, current_user)


@router.get("/restaurant-invoices/restaurant/{restaurant_id}", response_model=list[RestaurantInvoiceResponse])
def invoices_for_restaurant(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return restaurant_billing_service.list_invoices_for_restaurant(db, current_user, restaurant_id)


@router.post("/restaurant-invoices/{invoice_id}/pay", response_model=RestaurantPaymentResponse, status_code=201)
def pay_restaurant_invoice(
    invoice_id: uuid.UUID,
    data: RestaurantPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return restaurant_billing_service.pay_invoice(db, invoice_id, current_user, data)