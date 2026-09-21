import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.delivery import DeliveryResponse, DeliveryAssignDriver, DeliveryStatusUpdate
from app.services import delivery_service

router = APIRouter(prefix="/api/v1/deliveries", tags=["Delivery"])


@router.get("/my", response_model=list[DeliveryResponse])
def my_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.DELIVERY)),
):
    return delivery_service.list_my_deliveries(db, current_user.id)


@router.get("/order/{order_id}", response_model=DeliveryResponse)
def delivery_for_order(
    order_id: uuid.UUID,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    delivery = delivery_service.get_delivery_for_order(
        db,
        current_user,
        order_id,
    )
    return delivery_service._attach_display_fields(
        db,
        delivery,
    )


@router.get("/restaurant/{restaurant_id}", response_model=list[DeliveryResponse])
def deliveries_for_restaurant(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return delivery_service.list_pending_deliveries_for_restaurant(db, current_user, restaurant_id)


@router.patch("/{delivery_id}/assign", response_model=DeliveryResponse)
def assign_driver(
    delivery_id: uuid.UUID,
    data: DeliveryAssignDriver,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return delivery_service.assign_driver(db, current_user, delivery_id, data.driver_id)


@router.patch("/{delivery_id}/status", response_model=DeliveryResponse)
def update_delivery_status(
    delivery_id: uuid.UUID,
    data: DeliveryStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.DELIVERY)),
):
    return delivery_service.update_delivery_status(db, current_user, delivery_id, data.status)