import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.restaurant import (
    MenuItem,
    MenuCategory,
    Restaurant,
    Order,
    OrderItem,
    OrderType,
)
from app.models.delivery import Delivery
from app.models.user import User


def _find_menu_items(
    db: Session,
    message: str,
    limit: int = 8,
) -> list[MenuItem]:
    text = message.lower().strip()

    query = (
        db.query(MenuItem)
        .join(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .join(Restaurant, MenuCategory.restaurant_id == Restaurant.id)
        .filter(
            MenuItem.is_available.is_(True),
            Restaurant.is_active.is_(True),
        )
    )

    items = query.all()

    # Simple deterministic filtering.
    # AI must never invent menu items.
    tokens = {
        token
        for token in text.replace(",", " ").split()
        if len(token) >= 3
    }

    dietary_matches = []

    for item in items:
        searchable = " ".join(
            [
                item.name or "",
                item.description or "",
                " ".join(item.dietary_tags or []),
            ]
        ).lower()

        score = 0

        for token in tokens:
            if token in searchable:
                score += 1

        if "vegan" in text and "vegan" in searchable:
            score += 5

        if "vegetarian" in text and "vegetarian" in searchable:
            score += 5

        if "spicy" in text and "spicy" in searchable:
            score += 5

        if "signature" in text and item.is_signature:
            score += 5

        if score > 0:
            dietary_matches.append((score, item))

    dietary_matches.sort(
        key=lambda value: (
            -value[0],
            value[1].name.lower(),
        )
    )

    return [item for _, item in dietary_matches[:limit]]


def _format_menu_item(item: MenuItem) -> str:
    tags = ", ".join(item.dietary_tags or [])

    result = f"• {item.name} — ${item.price}"

    if item.description:
        result += f"\n  {item.description}"

    if tags:
        result += f"\n  Tags: {tags}"

    if item.is_signature:
        result += "\n  Signature dish"

    return result


def recommend_menu(
    db: Session,
    current_user: User,
    message: str,
):
    items = _find_menu_items(db, message)

    if not items:
        return {
            "message": (
                "I couldn't find an available menu item matching "
                "those preferences. Try another cuisine, dish, "
                "dietary preference, or ingredient."
            ),
            "action": None,
            "restaurant_id": None,
            "menu_item_ids": [],
            "order_id": None,
        }

    restaurant_ids = {
        item.category.restaurant_id
        for item in items
        if item.category and item.category.restaurant_id
    }

    restaurant_id = None

    if len(restaurant_ids) == 1:
        restaurant_id = str(next(iter(restaurant_ids)))

    message_text = "Here are available menu items that match your request:\n\n"
    message_text += "\n\n".join(
        _format_menu_item(item)
        for item in items
    )

    return {
        "message": message_text,
        "action": "SHOW_MENU_ITEMS",
        "restaurant_id": restaurant_id,
        "menu_item_ids": [str(item.id) for item in items],
        "order_id": None,
    }


def get_order_status(
    db: Session,
    current_user: User,
    order_id: uuid.UUID,
):
    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.customer_id == current_user.id,
            Order.order_type == OrderType.DELIVERY,
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    delivery = (
        db.query(Delivery)
        .filter(Delivery.order_id == order.id)
        .first()
    )

    if not delivery:
        return {
            "message": (
                f"Your order {order.order_number} is currently "
                f"{order.status.value.replace('_', ' ').title()}."
            ),
            "action": "VIEW_ORDER",
            "restaurant_id": str(order.restaurant_id),
            "menu_item_ids": [],
            "order_id": str(order.id),
        }

    status_text = delivery.status.value.replace("_", " ").title()

    message_text = (
        f"Your order {order.order_number} is currently "
        f"{status_text.lower()}."
    )

    if delivery.driver_name:
        message_text += f" Your driver is {delivery.driver_name}."

    if delivery.delivered_at:
        message_text += " Your order has been delivered."

    return {
        "message": message_text,
        "action": "VIEW_ORDER",
        "restaurant_id": str(order.restaurant_id),
        "menu_item_ids": [],
        "order_id": str(order.id),
    }


def get_last_delivery_order(
    db: Session,
    current_user: User,
):
    order = (
        db.query(Order)
        .filter(
            Order.customer_id == current_user.id,
            Order.order_type == OrderType.DELIVERY,
        )
        .order_by(Order.created_at.desc())
        .first()
    )

    if not order:
        return {
            "message": "You don't have a previous delivery order yet.",
            "action": None,
            "restaurant_id": None,
            "menu_item_ids": [],
            "order_id": None,
        }

    items = (
        db.query(OrderItem)
        .filter(OrderItem.order_id == order.id)
        .all()
    )

    if not items:
        return {
            "message": (
                f"I found your previous order {order.order_number}, "
                "but it has no items available to reorder."
            ),
            "action": None,
            "restaurant_id": str(order.restaurant_id),
            "menu_item_ids": [],
            "order_id": str(order.id),
        }

    item_ids = [str(item.menu_item_id) for item in items]

    return {
        "message": (
            f"I found your previous delivery order "
            f"{order.order_number}. "
            f"It contains {len(items)} item(s). "
            "I can show these items again so you can review "
            "them before placing a new order."
        ),
        "action": "REORDER_REVIEW",
        "restaurant_id": str(order.restaurant_id),
        "menu_item_ids": item_ids,
        "order_id": str(order.id),
    }