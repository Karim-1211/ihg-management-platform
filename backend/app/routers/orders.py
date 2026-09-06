import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.restaurant import (
    OrderCreate, OrderResponse, OrderStatusUpdate, OrderAssignWaiter,
)
from app.services import order_service

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])


@router.post("", response_model=OrderResponse, status_code=201)
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return order_service.create_order(db, current_user, data)


@router.get("/my", response_model=list[OrderResponse])
def my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return order_service.list_my_orders(db, current_user.id)


@router.get("/restaurant/{restaurant_id}", response_model=list[OrderResponse])
def orders_for_restaurant(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER, RoleEnum.KITCHEN)),
):
    return order_service.list_orders_for_restaurant(db, current_user, restaurant_id)


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: uuid.UUID,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER, RoleEnum.KITCHEN)),
):
    return order_service.update_order_status(db, current_user, order_id, data.status)


@router.patch("/{order_id}/assign-waiter", response_model=OrderResponse)
def assign_waiter(
    order_id: uuid.UUID,
    data: OrderAssignWaiter,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return order_service.assign_waiter(db, current_user, order_id, data.waiter_id)