"""Phase 20.2/20.3 — whitelisted, read-only tool registry for the
Customer/Guest AI Assistant. Every tool wraps an already-existing,
already-regression-tested service function and is called with the real
current_user bound by the orchestration layer — the model never supplies a
customer_id/guest_id. This is the sole mechanism by which the AI touches
data; there is no other path."""

import uuid
from datetime import date, datetime
from collections import Counter

from sqlalchemy.orm import Session

from app.models.hotel import Hotel, Room, RoomType
from app.models.restaurant import MenuItem, Order as OrderModel, OrderItem
from app.models.media import MediaEntityType
from app.models.user import User
from app.services import booking_service, service_request_service, hotel_service
from app.services import restaurant_service, order_service, reservation_service
from app.models.restaurant import Restaurant
from app.services import billing_service, restaurant_billing_service, business_rule_service
from app.services import media_service


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


def _tool_get_hotel_info(db: Session, current_user: User, hotel_id: str | None = None) -> dict:
    if hotel_id:
        hotel = hotel_service.get_hotel_or_404(db, uuid.UUID(hotel_id))
    else:
        hotels = hotel_service.list_hotels(db)
        if not hotels:
            return {"error": "No hotels are configured."}
        if len(hotels) > 1:
            return {"error": "More than one hotel exists — call list_hotels and ask the customer which one they mean, then call this again with that hotel_id."}
        hotel = hotels[0]
    return {
        "hotel_id": str(hotel.id),
        "name": hotel.name,
        "address": getattr(hotel, "address", None),
        "description": getattr(hotel, "description", None),
        "phone": getattr(hotel, "phone", None),
    }


def _tool_get_room_types_catalog(db: Session, current_user: User, hotel_id: str | None = None) -> dict:
    """General information about a hotel's room types — no dates required.
    Auto-resolves the hotel the same way _tool_get_hotel_info does."""
    if hotel_id:
        try:
            hid = uuid.UUID(hotel_id)
        except ValueError:
            return {"error": "Invalid hotel_id."}
        hotel = db.query(Hotel).filter(Hotel.id == hid).first()
        if not hotel:
            return {"error": "Hotel not found."}
    else:
        hotels = db.query(Hotel).all()
        if not hotels:
            return {"error": "No hotels are configured."}
        if len(hotels) > 1:
            return {"error": "More than one hotel exists — call list_hotels and ask the customer which one they mean, then call this again with that hotel_id."}
        hotel = hotels[0]

    room_types = db.query(RoomType).filter(RoomType.hotel_id == hotel.id).all()
    return {
        "hotel_id": str(hotel.id),
        "hotel_name": hotel.name,
        "room_type_count": len(room_types),
        "room_types": [
            {
                "name": rt.name,
                "description": rt.description,
                "base_price": float(rt.base_price),
                "max_occupancy": rt.max_occupancy,
                "view_type": rt.view_type,
                "bed_configuration": rt.bed_configuration,
                "has_balcony": bool(rt.has_balcony),
                "has_bathtub": bool(rt.has_bathtub),
                "amenities": list(rt.amenities) if rt.amenities else [],
            }
            for rt in room_types
        ],
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


def _tool_get_hotel_room_types(db: Session, current_user: User, hotel_id: str | None = None) -> dict:
    """Answers general 'what rooms do you have' browsing questions —
    deliberately separate from get_room_recommendations, which is for
    checking real availability against specific dates. This never
    requires dates. If hotel_id is omitted and there's exactly one hotel
    with configured room types, that hotel is used automatically rather
    than asking the customer to disambiguate a choice they don't have."""
    hotels = hotel_service.list_hotels(db)
    if hotel_id:
        target_hotels = [h for h in hotels if str(h.id) == hotel_id]
    else:
        target_hotels = hotels

    results = []
    for hotel in target_hotels:
        room_types = db.query(RoomType).filter(RoomType.hotel_id == hotel.id).all()
        if not room_types:
            continue
        results.append({
            "hotel_id": str(hotel.id),
            "hotel_name": hotel.name,
            "room_types": [
                {
                    "name": rt.name,
                    "base_price": float(rt.base_price),
                    "max_occupancy": rt.max_occupancy,
                    "view_type": rt.view_type,
                    "bed_configuration": rt.bed_configuration,
                    "has_balcony": bool(rt.has_balcony),
                    "has_bathtub": bool(rt.has_bathtub),
                    "amenities": list(rt.amenities) if rt.amenities else [],
                }
                for rt in room_types
            ],
        })

    if not results:
        return {"error": "No room types are configured yet."}
    if not hotel_id and len(results) > 1:
        return {"multiple_hotels": True, "hotels": [{"hotel_id": r["hotel_id"], "hotel_name": r["hotel_name"]} for r in results]}
    return {"multiple_hotels": False, "hotels": results}


def _tool_get_business_policy_summary(db: Session, current_user: User, hotel_id: str | None = None) -> dict:
    hid = uuid.UUID(hotel_id) if hotel_id else None
    results = {}
    for label, (unit, getter) in _POLICY_KEYS.items():
        try:
            value = getter(db, hotel_id=hid)
            results[label] = f"{value} {unit}"
        except Exception:
            results[label] = "not configured"
    return results


def _room_detail(db: Session, room: Room) -> dict:
    """Phase 30b — full descriptive detail for one room, including its
    real primary photo. Every field here is a stored database value;
    nothing is inferred or generated by the AI."""
    room_type = db.query(RoomType).filter(RoomType.id == room.room_type_id).first()

    image_url = media_service.resolve_primary_image_url(db, MediaEntityType.ROOM, room.id)
    if not image_url and room_type:
        image_url = media_service.resolve_primary_image_url(db, MediaEntityType.ROOM_TYPE, room_type.id)

    return {
        "room_id": str(room.id),
        "room_number": room.room_number,
        "room_type": room_type.name if room_type else "Unknown",
        "description": room_type.description if room_type else None,
        "base_price": float(room_type.base_price) if room_type else None,
        "max_occupancy": room_type.max_occupancy if room_type else None,
        "view_type": room_type.view_type if room_type else None,
        "bed_configuration": room_type.bed_configuration if room_type else None,
        "has_balcony": bool(room_type.has_balcony) if room_type else False,
        "has_bathtub": bool(room_type.has_bathtub) if room_type else False,
        "amenities": list(room_type.amenities) if room_type and room_type.amenities else [],
        "primary_image_url": image_url,
    }


# Phase 30c — rule-based matching against a free-text preference string.
# Deliberately simple keyword matching against real stored fields only
# (view_type, has_balcony, has_bathtub). A criterion with no recognized
# keyword in the text is never enforced — this is not full NLU, and it
# never excludes a room based on something it can't actually check (e.g.
# "quiet floor" has no stored signal, so it's silently not filtered on).
_VIEW_KEYWORDS = {
    "mountain": "mountain",
    "sea": "sea",
    "ocean": "sea",
    "beach": "sea",
    "city": "city",
    "garden": "garden",
}


def _room_matches_preferences(detail: dict, preferences: str) -> bool:
    text = preferences.lower()
    view = (detail.get("view_type") or "").lower()

    requested_views = {label for kw, label in _VIEW_KEYWORDS.items() if kw in text}
    if requested_views and not any(v in view for v in requested_views):
        return False

    if "balcony" in text and not detail.get("has_balcony"):
        return False
    if any(kw in text for kw in ("bathtub", "bath tub", " tub")) and not detail.get("has_bathtub"):
        return False

    return True


def _tool_get_room_recommendations(
    db: Session, current_user: User, check_in_date: str, check_out_date: str, preferences: str | None = None
) -> dict:
    """Grounded in real current availability for the specific requested
    dates. When `preferences` is given, results are filtered to ONLY rooms
    matching it (never blended with unrelated rooms) — the caller (system
    prompt) is instructed to always pass the customer's stated wants
    through here rather than leaving filtering to the reply text alone."""
    try:
        check_in = date.fromisoformat(check_in_date)
        check_out = date.fromisoformat(check_out_date)
    except ValueError:
        return {"error": "Dates must be in YYYY-MM-DD format."}
    if check_out <= check_in:
        return {"error": "check_out_date must be after check_in_date."}

    available = booking_service.list_available_rooms(db, check_in, check_out)
    available_details = [_room_detail(db, r) for r in available]

    result: dict = {"personalized": False}

    if preferences and preferences.strip():
        matching_request = [d for d in available_details if _room_matches_preferences(d, preferences)]
        result["preference_query"] = preferences
        result["matching_your_request"] = matching_request[:10]
        if not matching_request:
            result["note"] = "No available room currently matches that specific request for these dates."
        return result

    past_bookings = booking_service.list_bookings(db, guest_id=current_user.id)
    if not past_bookings:
        result["note"] = "No booking history yet, so this is not personalized — showing general availability."
        result["available_rooms"] = available_details[:10]
        return result

    room_ids = [b.room_id for b in past_bookings]
    past_rooms = db.query(Room).filter(Room.id.in_(room_ids)).all()
    past_type_ids = [r.room_type_id for r in past_rooms]
    most_common_type_id = Counter(past_type_ids).most_common(1)[0][0] if past_type_ids else None
    preferred_type = db.query(RoomType).filter(RoomType.id == most_common_type_id).first() if most_common_type_id else None

    matching_past = [d for d in available_details if preferred_type and d["room_type"] == preferred_type.name]
    other = [d for d in available_details if d not in matching_past]

    result["personalized"] = True
    result["based_on"] = f"You've previously stayed in {preferred_type.name if preferred_type else 'various room types'}."
    result["matching_your_past_stays"] = matching_past[:5]
    result["other_available"] = other[:5]
    return result


def _resolve_single_restaurant(db: Session, restaurant_id: str | None):
    """Mirrors the hotel auto-resolution pattern: when the platform has
    exactly one restaurant there is nothing for the guest to choose
    between, so never make them answer 'which restaurant?'."""
    if restaurant_id:
        try:
            rid = uuid.UUID(restaurant_id)
        except ValueError:
            return None, {"error": "Invalid restaurant_id."}
        restaurant = db.query(Restaurant).filter(Restaurant.id == rid).first()
        if not restaurant:
            return None, {"error": "Restaurant not found."}
        return restaurant, None

    restaurants = restaurant_service.list_restaurants(db)
    if not restaurants:
        return None, {"error": "No restaurants are configured."}
    if len(restaurants) > 1:
        return None, {"error": "More than one restaurant exists — call list_restaurants and ask the customer which one they mean, then call this again with that restaurant_id."}
    return restaurants[0], None


def _tool_get_available_tables(
    db: Session,
    current_user: User,
    reservation_datetime: str,
    party_size: int,
    restaurant_id: str | None = None,
) -> dict:
    """Real table availability for a specific date/time and party size.
    Grounded in the same overlap check the booking service enforces, so
    a table offered here is genuinely bookable."""
    restaurant, error = _resolve_single_restaurant(db, restaurant_id)
    if error:
        return error

    try:
        start = datetime.fromisoformat(reservation_datetime)
    except ValueError:
        return {"error": "reservation_datetime must be ISO 8601, e.g. 2026-09-25T19:30:00."}

    if party_size < 1:
        return {"error": "party_size must be at least 1."}

    tables = reservation_service.list_available_tables(db, restaurant.id, start, party_size)

    return {
        "restaurant_id": str(restaurant.id),
        "restaurant_name": restaurant.name,
        "reservation_datetime": start.isoformat(),
        "party_size": party_size,
        "available_table_count": len(tables),
        "available_tables": [
            {"table_id": str(t.id), "table_number": t.table_number, "capacity": t.capacity}
            for t in tables[:10]
        ],
    }


def _tool_get_restaurant_info(db: Session, current_user: User, restaurant_id: str | None = None) -> dict:
    restaurant, error = _resolve_single_restaurant(db, restaurant_id)
    if error:
        return error
    return {
        "restaurant_id": str(restaurant.id),
        "name": restaurant.name,
        "description": getattr(restaurant, "description", None),
        "address": getattr(restaurant, "address", None),
        "phone": getattr(restaurant, "phone", None),
    }


def _tool_get_menu_recommendations(db: Session, current_user: User, restaurant_id: str) -> dict:
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
    {"name": "get_hotel_info", "description": "Get public details (address, description, phone) for a hotel. Omit hotel_id when there's only one hotel in the system — the tool resolves this automatically. Only ask the customer which hotel if this tool's result says there's more than one.",
     "input_schema": {"type": "object", "properties": {"hotel_id": {"type": "string", "description": "Optional. Only needed if the system has more than one hotel."}}, "required": []}},
    {"name": "get_room_types_catalog", "description": "Get general information about what room types a hotel offers — names, descriptions, prices, views, amenities. Use for questions like 'what kinds of rooms do you have' or 'how many room types are there' that do NOT require checking dates or live availability. Omit hotel_id when there's only one hotel (resolves automatically); only ask the customer which hotel if this tool's result says there's more than one.",
     "input_schema": {"type": "object", "properties": {"hotel_id": {"type": "string", "description": "Optional. Only needed if the system has more than one hotel."}}, "required": []}},
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
    {"name": "get_hotel_room_types", "description": "Get the room types a hotel offers (name, price, view, bed configuration, amenities, max occupancy) as a general browsing answer — for questions like 'what kinds of rooms do you have' or 'what room types exist'. This does NOT require or check dates; use get_room_recommendations instead when the customer wants to know what's actually available/bookable for specific dates. If there's only one hotel with rooms configured, omitting hotel_id will resolve it automatically.",
     "input_schema": {"type": "object", "properties": {"hotel_id": {"type": "string", "description": "Optional hotel UUID, from list_hotels. Omit if there's only one relevant hotel or none has been specified yet."}}, "required": []}},
    {"name": "get_room_recommendations", "description": "Get room recommendations for a SPECIFIC check-in and check-out date the customer must provide. Never call this without real dates. If the customer described what they want in a room (a view, a balcony, a bathtub, etc.), ALWAYS pass their exact wording in the preferences parameter — results will be filtered to match it, showing only what they asked for. Only omit preferences when the customer gave no specific criteria at all.",
     "input_schema": {"type": "object", "properties": {
         "check_in_date": {"type": "string", "description": "Check-in date in YYYY-MM-DD format, as given by the customer."},
         "check_out_date": {"type": "string", "description": "Check-out date in YYYY-MM-DD format, as given by the customer."},
         "preferences": {"type": "string", "description": "The customer's own words describing what they want in a room (e.g. 'mountain view with a balcony'). Pass through whenever they stated any room feature — never paraphrase or invent details."},
     }, "required": ["check_in_date", "check_out_date"]}},
    {"name": "get_restaurant_info", "description": "Get public details (name, description, address, phone) for a restaurant. Omit restaurant_id when there's only one restaurant — the tool resolves it automatically. Only ask which restaurant if the result says there's more than one.",
     "input_schema": {"type": "object", "properties": {"restaurant_id": {"type": "string", "description": "Optional. Only needed if the platform has more than one restaurant."}}, "required": []}},
    {"name": "get_available_tables", "description": "Check which tables are genuinely free for a SPECIFIC date/time and party size. Use this before suggesting a guest reserve — never claim a table is available without calling it. Requires the exact datetime and party size; ask the customer for whichever is missing rather than assuming. Omit restaurant_id when there's only one restaurant.",
     "input_schema": {"type": "object", "properties": {
         "reservation_datetime": {"type": "string", "description": "ISO 8601 date and time, e.g. 2026-09-25T19:30:00, built from what the customer told you."},
         "party_size": {"type": "integer", "description": "Number of guests, as given by the customer."},
         "restaurant_id": {"type": "string", "description": "Optional. Only needed if there's more than one restaurant."},
     }, "required": ["reservation_datetime", "party_size"]}},
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
    "get_room_types_catalog": _tool_get_room_types_catalog,
    "list_restaurants": _tool_list_restaurants,
    "get_restaurant_menu": _tool_get_restaurant_menu,
    "get_my_orders": _tool_get_my_orders,
    "get_my_reservations": _tool_get_my_reservations,
    "get_my_invoices": _tool_get_my_invoices,
    "get_business_policy_summary": _tool_get_business_policy_summary,
    "get_hotel_room_types": _tool_get_hotel_room_types,
    "get_room_recommendations": _tool_get_room_recommendations,
    "get_menu_recommendations": _tool_get_menu_recommendations,
    "get_restaurant_info": _tool_get_restaurant_info,
    "get_available_tables": _tool_get_available_tables,
}


def dispatch_tool(db: Session, current_user: User, tool_name: str, tool_input: dict) -> dict:
    fn = TOOL_DISPATCH.get(tool_name)
    if fn is None:
        return {"error": "Unknown tool."}
    try:
        return fn(db, current_user, **tool_input)
    except Exception as e:
        return {"error": "This information isn't available right now."}