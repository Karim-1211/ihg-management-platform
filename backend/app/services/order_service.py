import uuid
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.restaurant import (
    Order, OrderItem, OrderType, OrderStatus, MenuItem, MenuCategory, RestaurantTable,
)
from app.models.user import User, RoleEnum
from app.schemas.restaurant import OrderCreate
from app.schemas.notification_event import NotificationEvent
from app.models.notification import NotificationType
from app.services.restaurant_service import assert_restaurant_access, get_restaurant_or_404
from app.services import audit_service
from app.services import notification_service
from app.services import business_rule_service


def _round_currency(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def generate_order_number() -> str:
    return f"ORD{uuid.uuid4().hex[:8].upper()}"


def _validate_order_type_fields(data: OrderCreate) -> None:
    if data.order_type == OrderType.DINE_IN:
        if not data.table_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="table_id is required for a DINE_IN order.")
        if data.booking_id or data.delivery_address:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="DINE_IN orders cannot include booking_id or delivery_address.")
    elif data.order_type == OrderType.ROOM_SERVICE:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="ROOM_SERVICE orders are not yet available.")
    elif data.order_type == OrderType.DELIVERY:
        if not data.delivery_address:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="delivery_address is required for a DELIVERY order.")
        if data.table_id or data.booking_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="DELIVERY orders cannot include table_id or booking_id.")


def price_order_lines(db: Session, restaurant_id: uuid.UUID, lines) -> dict:
    """Single source of truth for order pricing. Used by create_order AND by
    the delivery quote endpoint, so a checkout quote can never disagree with
    the order it previews. Every line is validated against the live menu: it
    must exist, belong to THIS restaurant, and currently be available.

    `lines` is any sequence of objects with `menu_item_id` and `quantity`.
    The returned OrderItem objects are transient — the caller decides
    whether to persist them."""
    order_items: list[OrderItem] = []
    subtotal = Decimal("0")
    for line in lines:
        menu_item = db.query(MenuItem).filter(MenuItem.id == line.menu_item_id).first()
        if not menu_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Menu item {line.menu_item_id} not found.")
        category = db.query(MenuCategory).filter(MenuCategory.id == menu_item.category_id).first()
        if not category or category.restaurant_id != restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"'{menu_item.name}' is not on this restaurant's menu.",
            )
        if not menu_item.is_available:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"'{menu_item.name}' is currently unavailable.")
        unit_price = Decimal(str(menu_item.price))
        line_subtotal = _round_currency(unit_price * line.quantity)
        subtotal += line_subtotal
        order_items.append(OrderItem(menu_item_id=menu_item.id, quantity=line.quantity, unit_price=unit_price, subtotal=line_subtotal))

    tax_rate = business_rule_service.get_tax_rate(db)
    tax_amount = _round_currency(subtotal * tax_rate)

    service_charge_rate = business_rule_service.get_restaurant_service_charge_rate(db, restaurant_id=restaurant_id)
    service_charge_amount = _round_currency(subtotal * service_charge_rate)

    discount_amount = Decimal("0")
    total_amount = _round_currency(subtotal + tax_amount + service_charge_amount - discount_amount)

    return {
        "order_items": order_items,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "service_charge_amount": service_charge_amount,
        "discount_amount": discount_amount,
        "total_amount": total_amount,
    }


def create_order(db: Session, current_user: User, data: OrderCreate) -> Order:
    from app.models.delivery import Delivery, DeliveryStatus
    restaurant = get_restaurant_or_404(db, data.restaurant_id)
    if not restaurant.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This restaurant is not currently accepting orders.")
    _validate_order_type_fields(data)
    table = None
    if data.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == data.table_id).first()
        if not table or table.restaurant_id != data.restaurant_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found at this restaurant.")

    pricing = price_order_lines(db, data.restaurant_id, data.items)
    order_items = pricing["order_items"]
    total_amount = pricing["total_amount"]

    order = Order(
        order_number=generate_order_number(), order_type=data.order_type, restaurant_id=data.restaurant_id,
        customer_id=current_user.id if current_user.role == RoleEnum.CUSTOMER else None,
        table_id=data.table_id, delivery_address=data.delivery_address, status=OrderStatus.NEW,
        subtotal=pricing["subtotal"], tax_amount=pricing["tax_amount"],
        service_charge_amount=pricing["service_charge_amount"],
        discount_amount=pricing["discount_amount"], total_amount=total_amount,
    )
    db.add(order)
    db.flush()
    for item in order_items:
        item.order_id = order.id
        db.add(item)
    if table:
        table.status = table.status.__class__.OCCUPIED
    if data.order_type == OrderType.DELIVERY:
        delivery = Delivery(order_id=order.id, status=DeliveryStatus.PENDING)
        db.add(delivery)
    db.commit()
    db.refresh(order)
    audit_service.log_action(db, current_user.id, "CREATE_ORDER", "order", order.id, f"Created {data.order_type.value} order {order.order_number} (${total_amount})")
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.ORDER_CREATED, actor_user_id=current_user.id, entity_type="order",
        entity_id=order.id, restaurant_id=order.restaurant_id, metadata={"order_number": order.order_number},
    ))
    return _attach_display_fields(db, order)


def _attach_display_fields(db: Session, order: Order) -> Order:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    for item in items:
        menu_item = db.query(MenuItem).filter(MenuItem.id == item.menu_item_id).first()
        if menu_item:
            item.menu_item_name = menu_item.name
    order.items = items
    if order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table:
            order.table_number = table.table_number

    # Phase 19.2: read-only enrichment for DELIVERY orders — attaches
    # already-existing Delivery data (Phase 12) so customers can see
    # delivery progress. No new workflow logic, no change to Delivery
    # itself; this is purely a display-layer addition to an order listing.
    order.delivery_status = None
    order.delivery_driver_name = None
    order.delivery_assigned_at = None
    order.delivery_picked_up_at = None
    order.delivery_out_for_delivery_at = None
    order.delivery_delivered_at = None
    if order.order_type == OrderType.DELIVERY:
        from app.models.delivery import Delivery
        delivery = db.query(Delivery).filter(Delivery.order_id == order.id).first()
        if delivery:
            order.delivery_status = delivery.status.value
            order.delivery_assigned_at = delivery.assigned_at
            order.delivery_picked_up_at = delivery.picked_up_at
            order.delivery_delivered_at = delivery.delivered_at
            if delivery.delivery_staff_id:
                driver = db.query(User).filter(User.id == delivery.delivery_staff_id).first()
                if driver:
                    order.delivery_driver_name = f"{driver.first_name} {driver.last_name}"

    return order


def get_order_or_404(db: Session, order_id: uuid.UUID) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return order


def get_my_order(
    db: Session,
    current_user: User,
    order_id: uuid.UUID,
) -> Order:
    order = get_order_or_404(db, order_id)

    if current_user.role == RoleEnum.CUSTOMER:
        if order.customer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found.",
            )
    else:
        assert_restaurant_access(
            db,
            current_user,
            order.restaurant_id,
        )

    return _attach_display_fields(db, order)


def list_orders_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[Order]:
    assert_restaurant_access(db, current_user, restaurant_id)
    orders = db.query(Order).filter(Order.restaurant_id == restaurant_id).order_by(Order.created_at.desc()).all()
    return [_attach_display_fields(db, o) for o in orders]


def list_my_orders(db: Session, customer_id: uuid.UUID) -> list[Order]:
    orders = db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.created_at.desc()).all()
    return [_attach_display_fields(db, o) for o in orders]


VALID_TRANSITIONS = {
    OrderStatus.NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    OrderStatus.PREPARING: [OrderStatus.READY],
    OrderStatus.READY: [OrderStatus.SERVED],
    OrderStatus.SERVED: [],
    OrderStatus.CANCELLED: [],
}


def update_order_status(db: Session, current_user: User, order_id: uuid.UUID, new_status: OrderStatus) -> Order:
    from app.services import inventory_service
    order = get_order_or_404(db, order_id)
    assert_restaurant_access(db, current_user, order.restaurant_id)
    if order.order_type == OrderType.DELIVERY and new_status == OrderStatus.SERVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Delivery orders are marked SERVED automatically once the delivery is completed.")
    allowed_next = VALID_TRANSITIONS.get(order.status, [])
    if new_status not in allowed_next:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot move order from {order.status.value} to {new_status.value}.")
    if new_status == OrderStatus.CONFIRMED:
        order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        inventory_service.deduct_stock_for_order(db, order, order_items)
    if new_status == OrderStatus.PREPARING:
        from datetime import datetime, timezone
        order.preparing_started_at = datetime.now(timezone.utc)
    order.status = new_status
    if new_status == OrderStatus.SERVED and order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table:
            table.status = table.status.__class__.CLEANING
    db.commit()
    db.refresh(order)
    if new_status == OrderStatus.READY:
        notification_service.dispatch(db, NotificationEvent(
            event_type=NotificationType.ORDER_READY, actor_user_id=current_user.id, entity_type="order",
            entity_id=order.id, restaurant_id=order.restaurant_id,
            metadata={"order_number": order.order_number, "customer_id": str(order.customer_id) if order.customer_id else None},
        ))
    if new_status == OrderStatus.SERVED:
        from app.services import restaurant_billing_service
        restaurant_billing_service.generate_invoice_for_order(db, order)
        notification_service.dispatch(db, NotificationEvent(
            event_type=NotificationType.ORDER_SERVED, actor_user_id=current_user.id, entity_type="order",
            entity_id=order.id, restaurant_id=order.restaurant_id,
            metadata={"order_number": order.order_number, "customer_id": str(order.customer_id) if order.customer_id else None},
        ))
    return _attach_display_fields(db, order)


def assign_waiter(db: Session, current_user: User, order_id: uuid.UUID, waiter_id: uuid.UUID) -> Order:
    order = get_order_or_404(db, order_id)
    assert_restaurant_access(db, current_user, order.restaurant_id)
    waiter = db.query(User).filter(User.id == waiter_id, User.role == RoleEnum.WAITER).first()
    if not waiter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waiter not found.")
    if waiter.restaurant_id != order.restaurant_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="This waiter is not assigned to this restaurant.")
    order.assigned_waiter_id = waiter.id
    db.commit()
    db.refresh(order)
    return _attach_display_fields(db, order)