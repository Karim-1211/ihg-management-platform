"""Phase 20.2/20.3 — whitelisted, read-only tool registry for the
Customer/Guest AI Assistant. Every tool wraps an already-existing,
already-regression-tested service function and is called with the real
current_user bound by the orchestration layer — the model never supplies a
customer_id/guest_id. This is the sole mechanism by which the AI touches
data; there is no other path."""

import uuid
from datetime import date
from collections import Counter

from sqlalchemy.orm import Session

from app.models.hotel import Room, RoomType
from app.models.restaurant import MenuItem, Order as OrderModel, OrderItem
from app.models.user import User
from app.services import booking_service, service_request_service, hotel_service
from app.services import restaurant_service, order_service, reservation_service
from app.services import billing_service, restaurant_billing_service, business_rule_service


def _tool_get_my_bookings(db: Session, current_user: User) -> list[dict]:
    bookings = booking_service.list_bookings(db, guest_id=current_user.id)
    return [
        {
            "booking_reference": b.booking_reference,
            "check_in_date": str(b.check_in_date),
            "check_out_date": str(b.check_out_date),
            "status": b.status.value,
            "number_of_guests": b.number_of_guests,
            "total_amount": float(b.total_amount),
        }
        for b in bookings
    ]


def _tool_get_my_active_stay(db: Session, current_user: User) -> dict:
    bookings = booking_service.list_bookings(db, guest_id=current_user.id)
    active = [b for b in bookings if b.status.value in ("CONFIRMED", "CHECKED_IN")]
    if not active:
        return {"has_active_stay": False}
    b = active[0]
    room = db.query(Room).filter(Room.id == b.room_id).first()
    return {
        "has_active_stay": True,
        "booking_reference": b.booking_reference,
        "status": b.status.value,
        "check_in_date": str(b.check_in_date),
        "check_out_date": str(b.check_out_date),
        "room_number": room.room_number if room else None,
    }


def _tool_get_my_service_requests(db: Session, current_user: User) -> list[dict]:
    reqs = service_request_service.list_my_service_requests(db, guest_id=current_user.id)
    return [
        {
            "request_type": r.request_type.value,
            "description": r.description,
            "status": r.status.value,
            "price": float(r.price) if r.price is not None else None,
            "booking_reference": getattr(r, "booking_reference", None),
        }
        for r in reqs
    ]


def _tool_list_hotels(db: Session, current_user: User) -> list[dict]:
    hotels = hotel_service.list_hotels(db)
    return [{"hotel_id": str(h.id), "name": h.name} for h in hotels]


def _tool_get_hotel_info(db: Session, current_user: User, hotel_id: str) -> dict:
    hotel = hotel_service.get_hotel_or_404(db, uuid.UUID(hotel_id))
    return {
        "hotel_id": str(hotel.id),
        "name": hotel.name,
        "address": getattr(hotel, "address", None),
        "description": getattr(hotel, "description", None),
        "phone": getattr(hotel, "phone", None),
    }


def _tool_list_restaurants(db: Session, current_user: User) -> list[dict]:
    restaurants = restaurant_service.list_restaurants(db)
    return [{"restaurant_id": str(r.id), "name": r.name, "address": r.address} for r in restaurants]


def _tool_get_restaurant_menu(db: Session, current_user: User, restaurant_id: str) -> list[dict]:
    restaurant_service.get_restaurant_or_404(db, uuid.UUID(restaurant_id))
    categories = restaurant_service.get_full_menu(db, uuid.UUID(restaurant_id))
    return [
        {
            "category": c.name,
            "items": [
                {"name": i.name, "description": i.description, "price": float(i.price)}
                for i in c.items if i.is_available
            ],
        }
        for c in categories
    ]


def _tool_get_my_orders(db: Session, current_user: User) -> list[dict]:
    orders = order_service.list_my_orders(db, customer_id=current_user.id)
    result = []
    for o in orders:
        entry = {
            "order_number": o.order_number,
            "order_type": o.order_type.value,
            "status": o.status.value,
            "total_amount": float(o.total_amount),
            "items": [f"{it.quantity}x {it.menu_item_name or 'item'}" for it in o.items],
        }
        if o.order_type.value == "DELIVERY":
            entry["delivery_status"] = o.delivery_status
            entry["delivery_driver_name"] = o.delivery_driver_name
        result.append(entry)
    return result


def _tool_get_my_reservations(db: Session, current_user: User) -> list[dict]:
    reservations = reservation_service.list_my_reservations(db, customer_id=current_user.id)
    return [
        {
            "restaurant_name": r.restaurant_name,
            "table_number": r.table_number,
            "reservation_start": str(r.reservation_start),
            "party_size": r.party_size,
            "status": r.status.value,
        }
        for r in reservations
    ]


def _tool_get_my_invoices(db: Session, current_user: User) -> list[dict]:
    hotel_invoices = billing_service.list_my_invoices(db, guest_id=current_user.id)
    restaurant_invoices = restaurant_billing_service.list_my_invoices(db, customer_id=current_user.id)
    result = []
    for i in hotel_invoices:
        result.append({
            "invoice_number": i.invoice_number, "kind": "hotel", "status": i.status.value,
            "total_amount": float(i.total_amount), "amount_paid": float(i.amount_paid),
        })
    for i in restaurant_invoices:
        result.append({
            "invoice_number": i.invoice_number, "kind": "restaurant", "status": i.status.value,
            "total_amount": float(i.total_amount), "amount_paid": float(i.amount_paid),
        })
    return result


_POLICY_KEYS = {
    "Cancellation deadline": ("hours before check-in", business_rule_service.get_cancellation_deadline_hours),
    "Minimum stay": ("nights", business_rule_service.get_minimum_stay_nights),
    "Maximum stay": ("nights", business_rule_service.get_maximum_stay_nights),
    "Maximum advance booking": ("days", business_rule_service.get_maximum_advance_booking_days),
}


def _tool_get_business_policy_summary(db: Session, current_user: User, hotel_id: str | None = None) -> dict:
    """Deliberately returns ONLY {friendly_label: 'value unit'} pairs — never
    rule_id, priority, scope_type, or any other governance metadata."""
    hid = uuid.UUID(hotel_id) if hotel_id else None
    results = {}
    for label, (unit, getter) in _POLICY_KEYS.items():
        try:
            value = getter(db, hotel_id=hid)
            results[label] = f"{value} {unit}"
        except Exception:
            results[label] = "not configured"
    return results


def _room_summary(db: Session, room: Room) -> dict:
    room_type = db.query(RoomType).filter(RoomType.id == room.room_type_id).first()
    return {
        "room_id": str(room.id),
        "room_number": room.room_number,
        "room_type": room_type.name if room_type else "Unknown",
        "base_price": float(room_type.base_price) if room_type else None,
    }


def _tool_get_room_recommendations(db: Session, current_user: User, check_in_date: str, check_out_date: str) -> dict:
    """Grounded in the customer's real booking history AND real current
    availability for the specific requested dates. Never returns a room
    that isn't actually free for those exact dates. If the customer has no
    booking history, this is explicitly labeled as not personalized."""
    try:
        check_in = date.fromisoformat(check_in_date)
        check_out = date.fromisoformat(check_out_date)
    except ValueError:
        return {"error": "Dates must be in YYYY-MM-DD format."}
    if check_out <= check_in:
        return {"error": "check_out_date must be after check_in_date."}

    past_bookings = booking_service.list_bookings(db, guest_id=current_user.id)
    if not past_bookings:
        available = booking_service.list_available_rooms(db, check_in, check_out)
        return {
            "personalized": False,
            "note": "No booking history yet, so this is not personalized — showing general availability.",
            "available_rooms": [_room_summary(db, r) for r in available[:10]],
        }

    room_ids = [b.room_id for b in past_bookings]
    past_rooms = db.query(Room).filter(Room.id.in_(room_ids)).all()
    past_type_ids = [r.room_type_id for r in past_rooms]
    most_common_type_id = Counter(past_type_ids).most_common(1)[0][0] if past_type_ids else None
    preferred_type = db.query(RoomType).filter(RoomType.id == most_common_type_id).first() if most_common_type_id else None

    available = booking_service.list_available_rooms(db, check_in, check_out)
    matching = [r for r in available if preferred_type and r.room_type_id == preferred_type.id]
    other_available = [r for r in available if not preferred_type or r.room_type_id != preferred_type.id]

    return {
        "personalized": True,
        "based_on": f"You've previously stayed in {preferred_type.name if preferred_type else 'various room types'}.",
        "matching_preference_and_available": [_room_summary(db, r) for r in matching[:5]],
        "other_available": [_room_summary(db, r) for r in other_available[:5]],
    }


def _tool_get_menu_recommendations(db: Session, current_user: User, restaurant_id: str) -> dict:
    """Grounded strictly in ONE real restaurant's real current menu,
    matched against the customer's own past orders at that same
    restaurant. Never mixes in history from a different restaurant, and
    never recommends an item that isn't currently is_available=True."""
    try:
        rid = uuid.UUID(restaurant_id)
    except ValueError:
        return {"error": "Invalid restaurant_id."}

    restaurant_service.get_restaurant_or_404(db, rid)

    past_orders = (
        db.query(OrderModel)
        .filter(OrderModel.customer_id == current_user.id, OrderModel.restaurant_id == rid)
        .all()
    )
    current_menu = restaurant_service.get_full_menu(db, rid)
    all_available_items = [
        {"menu_item_id": str(i.id), "name": i.name, "price": float(i.price), "category": c.name}
        for c in current_menu for i in c.items if i.is_available
    ]

    if not past_orders:
        return {
            "personalized": False,
            "note": "No order history at this restaurant yet, so this is not personalized — showing the current menu.",
            "available_items": all_available_items[:10],
        }

    past_order_ids = [o.id for o in past_orders]
    past_items = db.query(OrderItem).filter(OrderItem.order_id.in_(past_order_ids)).all()
    past_menu_item_ids = {i.menu_item_id for i in past_items}
    past_menu_items = db.query(MenuItem).filter(MenuItem.id.in_(past_menu_item_ids)).all()
    past_categories = {mi.category_id for mi in past_menu_items}

    matching = [
        {"menu_item_id": str(i.id), "name": i.name, "price": float(i.price), "category": c.name}
        for c in current_menu for i in c.items
        if i.is_available and i.category_id in past_categories
    ]
    ordered_before_names = {mi.name for mi in past_menu_items}

    return {
        "personalized": True,
        "based_on": f"You've ordered from this restaurant before (e.g., {', '.join(list(ordered_before_names)[:3])}).",
        "similar_to_past_orders": matching[:8],
        "full_current_menu": all_available_items,
    }


TOOL_DEFINITIONS = [
    {"name": "get_my_bookings", "description": "Get all of the current customer's hotel bookings.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_my_active_stay", "description": "Get the customer's current or next upcoming hotel stay, including room number if checked in.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_my_service_requests", "description": "Get the customer's hotel service requests (cleaning, towels, food, amenities, etc.) and their status.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "list_hotels", "description": "List all hotels on the platform with their IDs and names.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_hotel_info", "description": "Get public details (address, description, phone) for a specific hotel.",
     "input_schema": {"type": "object", "properties": {"hotel_id": {"type": "string", "description": "UUID of the hotel, from list_hotels."}}, "required": ["hotel_id"]}},
    {"name": "list_restaurants", "description": "List all restaurants on the platform with their IDs and names.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_restaurant_menu", "description": "Get the full menu (categories and available items with prices) for a specific restaurant.",
     "input_schema": {"type": "object", "properties": {"restaurant_id": {"type": "string", "description": "UUID of the restaurant, from list_restaurants."}}, "required": ["restaurant_id"]}},
    {"name": "get_my_orders", "description": "Get the customer's restaurant and delivery orders, including delivery status and driver if applicable.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_my_reservations", "description": "Get the customer's restaurant table reservations.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_my_invoices", "description": "Get the customer's hotel and restaurant invoices, including paid/unpaid status and amounts.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_business_policy_summary", "description": "Get customer-facing hotel policies: cancellation deadline, minimum/maximum stay, maximum advance booking.",
     "input_schema": {"type": "object", "properties": {"hotel_id": {"type": "string", "description": "Optional hotel UUID for a hotel-specific policy; omit for the general policy."}}, "required": []}},
    {"name": "get_room_recommendations", "description": "Get room recommendations based on the customer's past bookings, for a SPECIFIC check-in and check-out date the customer must provide. Never call this without real dates from the customer.",
     "input_schema": {"type": "object", "properties": {
         "check_in_date": {"type": "string", "description": "Check-in date in YYYY-MM-DD format, as given by the customer."},
         "check_out_date": {"type": "string", "description": "Check-out date in YYYY-MM-DD format, as given by the customer."},
     }, "required": ["check_in_date", "check_out_date"]}},
    {"name": "get_menu_recommendations", "description": "Get menu item recommendations at a SPECIFIC restaurant, based on the customer's past orders at that same restaurant. Requires a restaurant_id — use list_restaurants first if you don't already know which restaurant the customer means, or ask the customer to clarify if they have history at more than one restaurant.",
     "input_schema": {"type": "object", "properties": {
         "restaurant_id": {"type": "string", "description": "UUID of the restaurant, from list_restaurants."},
     }, "required": ["restaurant_id"]}},
]

TOOL_DISPATCH = {
    "get_my_bookings": _tool_get_my_bookings,
    "get_my_active_stay": _tool_get_my_active_stay,
    "get_my_service_requests": _tool_get_my_service_requests,
    "list_hotels": _tool_list_hotels,
    "get_hotel_info": _tool_get_hotel_info,
    "list_restaurants": _tool_list_restaurants,
    "get_restaurant_menu": _tool_get_restaurant_menu,
    "get_my_orders": _tool_get_my_orders,
    "get_my_reservations": _tool_get_my_reservations,
    "get_my_invoices": _tool_get_my_invoices,
    "get_business_policy_summary": _tool_get_business_policy_summary,
    "get_room_recommendations": _tool_get_room_recommendations,
    "get_menu_recommendations": _tool_get_menu_recommendations,
}


def dispatch_tool(db: Session, current_user: User, tool_name: str, tool_input: dict) -> dict:
    fn = TOOL_DISPATCH.get(tool_name)
    if fn is None:
        return {"error": "Unknown tool."}
    try:
        return fn(db, current_user, **tool_input)
    except Exception as e:
        return {"error": "This information isn't available right now."}