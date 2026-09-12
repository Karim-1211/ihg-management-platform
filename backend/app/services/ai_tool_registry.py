"""Phase 20.2 — whitelisted, read-only tool registry for the Customer/Guest
AI Assistant. Every tool wraps an already-existing, already-regression-tested
service function and is called with the real current_user bound by the
orchestration layer — the model never supplies a customer_id/guest_id. This
is the sole mechanism by which the AI touches data; there is no other path."""

import uuid

from sqlalchemy.orm import Session

from app.models.hotel import Room
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
}


def dispatch_tool(db: Session, current_user: User, tool_name: str, tool_input: dict) -> dict:
    fn = TOOL_DISPATCH.get(tool_name)
    if fn is None:
        return {"error": "Unknown tool."}
    try:
        return fn(db, current_user, **tool_input)
    except Exception as e:
        return {"error": f"This information isn't available right now."}