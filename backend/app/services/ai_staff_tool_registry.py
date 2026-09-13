"""Phase 20.4/20.5/20.6 — whitelisted, read-only tool registry for the
Staff/Manager AI Assistant. Every tool wraps an already-existing,
already-regression-tested service function, called with the real
current_user. Role access is enforced twice: once by which tool
definitions are offered to the model (get_tool_definitions_for_role),
and again inside dispatch_staff_tool itself — a defense-in-depth pattern
matching 20.8's "AI cannot bypass permissions" requirement."""

from datetime import datetime, timezone, date, timedelta

from sqlalchemy.orm import Session

from app.models.hotel import Booking, BookingStatus, HousekeepingTask, HousekeepingStatus
from app.models.restaurant import Order, OrderStatus
from app.models.delivery import Delivery, DeliveryStatus
from app.models.user import User
from app.services import booking_service, service_request_service, order_service
from app.services import dashboard_service, report_service
from app.services.ai_tool_registry import _tool_get_business_policy_summary
from app.services.ai_staff_constants import ANOMALY_CHANGE_THRESHOLD_PERCENT


# ---------- RECEPTIONIST ----------

def _tool_get_todays_arrivals_departures(db: Session, current_user: User) -> dict:
    today = datetime.now(timezone.utc).date()
    all_bookings = booking_service.list_bookings(db)
    arrivals = [b for b in all_bookings if b.check_in_date == today and b.status != BookingStatus.CANCELLED]
    departures = [b for b in all_bookings if b.check_out_date == today and b.status != BookingStatus.CANCELLED]
    return {
        "arrivals_today": [{"booking_reference": b.booking_reference, "status": b.status.value, "guests": b.number_of_guests} for b in arrivals],
        "departures_today": [{"booking_reference": b.booking_reference, "status": b.status.value} for b in departures],
    }


def _tool_get_pending_service_requests(db: Session, current_user: User) -> list[dict]:
    reqs = service_request_service.list_all_service_requests(db)
    pending = [r for r in reqs if r.status.value in ("PENDING", "IN_PROGRESS")]
    return [
        {
            "request_type": r.request_type.value, "status": r.status.value,
            "description": r.description, "room_number": getattr(r, "room_number", None),
            "guest_name": getattr(r, "guest_name", None),
        }
        for r in pending
    ]


# ---------- HOUSEKEEPING ----------

def _tool_get_pending_housekeeping_tasks(db: Session, current_user: User) -> list[dict]:
    tasks = booking_service.list_housekeeping_tasks(db)
    pending = [t for t in tasks if t.status != HousekeepingStatus.DONE]
    return [
        {"room_number": getattr(t, "room_number", None), "status": t.status.value, "notes": t.notes}
        for t in pending
    ]


# ---------- WAITER / KITCHEN ----------

def _tool_get_restaurant_order_queue(db: Session, current_user: User) -> list[dict]:
    if not current_user.restaurant_id:
        return []
    orders = order_service.list_orders_for_restaurant(db, current_user, current_user.restaurant_id)
    active = [o for o in orders if o.status not in (OrderStatus.SERVED, OrderStatus.CANCELLED)]
    return [
        {
            "order_number": o.order_number, "status": o.status.value, "order_type": o.order_type.value,
            "table_number": getattr(o, "table_number", None),
            "item_count": len(o.items),
        }
        for o in active
    ]


# ---------- DELIVERY ----------

def _tool_get_my_assigned_deliveries(db: Session, current_user: User) -> list[dict]:
    deliveries = (
        db.query(Delivery)
        .filter(Delivery.delivery_staff_id == current_user.id, Delivery.status.notin_([DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED]))
        .all()
    )
    result = []
    for d in deliveries:
        order = db.query(Order).filter(Order.id == d.order_id).first()
        result.append({
            "order_number": order.order_number if order else None,
            "status": d.status.value,
            "delivery_address": order.delivery_address if order else None,
        })
    return result


# ---------- MANAGER / SUPER_ADMIN ----------

def _tool_get_dashboard_snapshot(db: Session, current_user: User) -> dict:
    result = dashboard_service.get_dashboard_overview(db, current_user)
    return result.model_dump(mode="json")


def _tool_get_business_summary(db: Session, current_user: User, preset: str = "today") -> dict:
    valid_presets = {"today", "yesterday", "last_7_days", "last_30_days", "this_month", "previous_month"}
    if preset not in valid_presets:
        preset = "today"
    result = report_service.get_executive_report(db, current_user, preset, None, None)
    return result.model_dump(mode="json")


def _tool_get_anomaly_summary(db: Session, current_user: User) -> dict:
    """Rule-based, explainable: reuses the period-comparison figures the
    Executive Report already computes (no new calculation engine), and
    flags anything whose change_percent exceeds a documented threshold."""
    report = report_service.get_executive_report(db, current_user, "today", None, None)
    dashboard = dashboard_service.get_dashboard_overview(db, current_user)

    anomalies = []
    metrics_to_check = {
        "Revenue": report.revenue,
        "Bookings created": report.bookings_created,
        "Orders created": report.orders_created,
        "Failed payments": report.failed_payments,
        "Inventory activity": report.inventory_activity_total,
    }
    for label, pv in metrics_to_check.items():
        if pv.change_percent is not None and abs(pv.change_percent) >= ANOMALY_CHANGE_THRESHOLD_PERCENT:
            anomalies.append({
                "metric": label, "current": pv.current, "previous": pv.previous,
                "change_percent": pv.change_percent,
                "note": f"{label} changed by {pv.change_percent}% versus the prior comparable period.",
            })

    for item in dashboard.attention:
        anomalies.append({"metric": item.category, "current": item.count, "note": item.label})

    return {"anomalies": anomalies, "threshold_used_percent": ANOMALY_CHANGE_THRESHOLD_PERCENT}


# ---------- Tool specs with role gating ----------

STAFF_TOOL_SPECS = [
    {"name": "get_todays_arrivals_departures", "description": "Get today's hotel arrivals and departures.",
     "input_schema": {"type": "object", "properties": {}, "required": []},
     "allowed_roles": {"RECEPTIONIST", "MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_todays_arrivals_departures},
    {"name": "get_pending_service_requests", "description": "Get all pending or in-progress hotel service requests.",
     "input_schema": {"type": "object", "properties": {}, "required": []},
     "allowed_roles": {"RECEPTIONIST", "HOUSEKEEPING", "MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_pending_service_requests},
    {"name": "get_pending_housekeeping_tasks", "description": "Get pending housekeeping tasks (rooms needing cleaning).",
     "input_schema": {"type": "object", "properties": {}, "required": []},
     "allowed_roles": {"HOUSEKEEPING", "MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_pending_housekeeping_tasks},
    {"name": "get_restaurant_order_queue", "description": "Get the current active order queue for this staff member's own restaurant.",
     "input_schema": {"type": "object", "properties": {}, "required": []},
     "allowed_roles": {"WAITER", "KITCHEN", "MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_restaurant_order_queue},
    {"name": "get_my_assigned_deliveries", "description": "Get deliveries currently assigned to this driver that aren't yet delivered.",
     "input_schema": {"type": "object", "properties": {}, "required": []},
     "allowed_roles": {"DELIVERY", "MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_my_assigned_deliveries},
    {"name": "get_dashboard_snapshot", "description": "Get the current live operational dashboard: occupancy, orders today, active deliveries, low stock, revenue today, and attention items.",
     "input_schema": {"type": "object", "properties": {}, "required": []},
     "allowed_roles": {"MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_dashboard_snapshot},
    {"name": "get_business_summary", "description": "Get the authoritative business performance report for a period (revenue, bookings, orders, failed payments, inventory activity), with period-over-period comparison.",
     "input_schema": {"type": "object", "properties": {
         "preset": {"type": "string", "description": "One of: today, yesterday, last_7_days, last_30_days, this_month, previous_month. Defaults to today."},
     }, "required": []},
     "allowed_roles": {"MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_business_summary},
    {"name": "get_anomaly_summary", "description": "Get a rule-based summary of unusual operational or financial changes today (large swings in revenue, bookings, orders, failed payments, inventory activity) plus current attention items.",
     "input_schema": {"type": "object", "properties": {}, "required": []},
     "allowed_roles": {"MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_anomaly_summary},
    {"name": "get_business_policy_summary", "description": "Get customer-facing hotel policies: cancellation deadline, minimum/maximum stay, maximum advance booking.",
     "input_schema": {"type": "object", "properties": {"hotel_id": {"type": "string", "description": "Optional hotel UUID; omit for the general policy."}}, "required": []},
     "allowed_roles": {"RECEPTIONIST", "MANAGER", "SUPER_ADMIN"}, "handler": _tool_get_business_policy_summary},
]


def get_tool_definitions_for_role(role: str) -> list[dict]:
    return [
        {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
        for t in STAFF_TOOL_SPECS if role in t["allowed_roles"]
    ]


def dispatch_staff_tool(db: Session, current_user: User, tool_name: str, tool_input: dict) -> dict:
    spec = next((t for t in STAFF_TOOL_SPECS if t["name"] == tool_name), None)
    if spec is None:
        return {"error": "Unknown tool."}
    if current_user.role.value not in spec["allowed_roles"]:
        return {"error": "This information isn't available for your role."}
    try:
        return spec["handler"](db, current_user, **tool_input)
    except Exception:
        return {"error": "This information isn't available right now."}