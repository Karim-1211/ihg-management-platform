import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.delivery import Delivery, DeliveryStatus
from app.models.restaurant import Order, OrderStatus, RestaurantTable
from app.models.user import User, RoleEnum
from app.services.restaurant_service import assert_restaurant_access
from app.services import audit_service


VALID_DELIVERY_TRANSITIONS = {
    DeliveryStatus.PENDING: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
    DeliveryStatus.ASSIGNED: [DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED],
    DeliveryStatus.PICKED_UP: [DeliveryStatus.OUT_FOR_DELIVERY],
    DeliveryStatus.OUT_FOR_DELIVERY: [DeliveryStatus.DELIVERED],
    DeliveryStatus.DELIVERED: [],
    DeliveryStatus.CANCELLED: [],
}


def _attach_display_fields(db: Session, delivery: Delivery) -> Delivery:
    order = db.query(Order).filter(Order.id == delivery.order_id).first()
    if order:
        delivery.order_number = order.order_number
        delivery.delivery_address = order.delivery_address
    if delivery.delivery_staff_id:
        driver = db.query(User).filter(User.id == delivery.delivery_staff_id).first()
        if driver:
            delivery.driver_name = f"{driver.first_name} {driver.last_name}"
    return delivery


def get_delivery_or_404(db: Session, delivery_id: uuid.UUID) -> Delivery:
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found.")
    return delivery


def get_delivery_for_order(db: Session, order_id: uuid.UUID) -> Delivery:
    delivery = db.query(Delivery).filter(Delivery.order_id == order_id).first()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No delivery record exists for this order.")
    return delivery


def _order_and_boundary_check(db: Session, current_user: User, delivery: Delivery) -> Order:
    order = db.query(Order).filter(Order.id == delivery.order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated order not found.")
    assert_restaurant_access(db, current_user, order.restaurant_id)
    return order


def list_pending_deliveries_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[Delivery]:
    assert_restaurant_access(db, current_user, restaurant_id)
    deliveries = (
        db.query(Delivery)
        .join(Order, Delivery.order_id == Order.id)
        .filter(Order.restaurant_id == restaurant_id)
        .order_by(Delivery.created_at.desc())
        .all()
    )
    return [_attach_display_fields(db, d) for d in deliveries]


def list_my_deliveries(db: Session, driver_id: uuid.UUID) -> list[Delivery]:
    deliveries = (
        db.query(Delivery)
        .filter(Delivery.delivery_staff_id == driver_id)
        .order_by(Delivery.created_at.desc())
        .all()
    )
    return [_attach_display_fields(db, d) for d in deliveries]


def assign_driver(db: Session, current_user: User, delivery_id: uuid.UUID, driver_id: uuid.UUID) -> Delivery:
    delivery = get_delivery_or_404(db, delivery_id)
    order = _order_and_boundary_check(db, current_user, delivery)

    if delivery.status != DeliveryStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot assign a driver to a delivery with status {delivery.status.value}.",
        )

    driver = db.query(User).filter(User.id == driver_id, User.role == RoleEnum.DELIVERY).first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery driver not found.")
    if driver.restaurant_id != order.restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="This driver is not assigned to this restaurant.",
        )

    delivery.delivery_staff_id = driver.id
    delivery.status = DeliveryStatus.ASSIGNED
    delivery.assigned_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(delivery)

    audit_service.log_action(
        db, current_user.id, "ASSIGN_DRIVER", "delivery", delivery.id,
        f"Assigned {driver.first_name} {driver.last_name} to delivery for order {order.order_number}",
    )
    return _attach_display_fields(db, delivery)


def update_delivery_status(db: Session, current_user: User, delivery_id: uuid.UUID, new_status: DeliveryStatus) -> Delivery:
    delivery = get_delivery_or_404(db, delivery_id)
    order = _order_and_boundary_check(db, current_user, delivery)

    if current_user.role == RoleEnum.DELIVERY and delivery.delivery_staff_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update deliveries assigned to you.",
        )

    allowed_next = VALID_DELIVERY_TRANSITIONS.get(delivery.status, [])
    if new_status not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot move delivery from {delivery.status.value} to {new_status.value}.",
        )

    delivery.status = new_status
    now = datetime.now(timezone.utc)
    if new_status == DeliveryStatus.PICKED_UP:
        delivery.picked_up_at = now
    elif new_status == DeliveryStatus.DELIVERED:
        delivery.delivered_at = now

    db.commit()
    db.refresh(delivery)

    if new_status == DeliveryStatus.DELIVERED:
        # Controlled cross-state-machine transition: delivery completion marks
        # the order SERVED, which in turn triggers invoice generation — the
        # single point where these two independent lifecycles intersect.
        order.status = OrderStatus.SERVED
        db.commit()
        db.refresh(order)

        from app.services import restaurant_billing_service
        restaurant_billing_service.generate_invoice_for_order(db, order)

        audit_service.log_action(
            db, current_user.id, "DELIVER_ORDER", "order", order.id,
            f"Order {order.order_number} delivered, marked SERVED",
        )

    return _attach_display_fields(db, delivery)