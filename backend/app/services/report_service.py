import uuid
from datetime import date, datetime, timezone, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.hotel import Booking, BookingStatus, Room
from app.models.restaurant import Order, OrderType, Restaurant
from app.models.billing import Payment, PaymentStatus
from app.models.inventory import InventoryItem, StockTransaction, TransactionType
from app.models.service_request import ServiceRequest, ServiceRequestStatus
from app.models.user import User, RoleEnum
from app.schemas.reports import (
    ExecutiveReportResponse, ReportPeriodEcho, PeriodValue,
    OrdersByType, InventoryActivityByType,
)
from app.services import report_constants as const


def _resolve_scope(db: Session, current_user: User) -> tuple[list, list]:
    """Identical pattern to dashboard_service.py's _resolve_scope — reused,
    not reimplemented. SUPER_ADMIN unfiltered; MANAGER scoped to their
    hotel_id and derived restaurant_ids."""
    if current_user.role == RoleEnum.SUPER_ADMIN:
        return [], []

    if current_user.role == RoleEnum.MANAGER:
        hotel_ids = [current_user.hotel_id] if current_user.hotel_id else []
        restaurant_ids = [
            r.id for r in db.query(Restaurant.id).filter(Restaurant.hotel_id.in_(hotel_ids)).all()
        ] if hotel_ids else []
        if current_user.restaurant_id and current_user.restaurant_id not in restaurant_ids:
            restaurant_ids.append(current_user.restaurant_id)
        return hotel_ids, restaurant_ids

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to view reports.")


def _resolve_period(preset: str, custom_start: date | None, custom_end: date | None) -> tuple[date, date, date, date]:
    """Returns (current_start, current_end, compare_start, compare_end) — all
    inclusive dates. The comparison period is computed programmatically from
    the exact duration of the current period, so 7/30/31/custom-day ranges
    all behave consistently, per the locked design."""
    if preset not in const.SUPPORTED_PRESETS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Unsupported period preset: {preset}")

    today = datetime.now(timezone.utc).date()

    if preset == "today":
        current_start = current_end = today
    elif preset == "yesterday":
        current_start = current_end = today - timedelta(days=1)
    elif preset == "last_7_days":
        current_end = today
        current_start = today - timedelta(days=6)
    elif preset == "last_30_days":
        current_end = today
        current_start = today - timedelta(days=29)
    elif preset == "this_month":
        current_start = today.replace(day=1)
        current_end = today
    elif preset == "previous_month":
        first_of_this_month = today.replace(day=1)
        current_end = first_of_this_month - timedelta(days=1)
        current_start = current_end.replace(day=1)
    elif preset == "custom":
        if not custom_start or not custom_end:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="custom period requires both start and end dates.")
        if custom_start > custom_end:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="start date must not be after end date.")
        if (custom_end - custom_start).days + 1 > const.MAX_CUSTOM_RANGE_DAYS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Custom range cannot exceed {const.MAX_CUSTOM_RANGE_DAYS} days.")
        current_start, current_end = custom_start, custom_end
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Unsupported period preset: {preset}")

    duration_days = (current_end - current_start).days + 1
    compare_end = current_start - timedelta(days=1)
    compare_start = compare_end - timedelta(days=duration_days - 1)

    return current_start, current_end, compare_start, compare_end


def _to_datetime_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """Converts inclusive [start, end] dates into a half-open
    [start_datetime, end_datetime) range for indexable timestamp queries.
    Never casts a column to ::date."""
    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    end_dt = datetime(end.year, end.month, end.day, tzinfo=timezone.utc) + timedelta(days=1)
    return start_dt, end_dt


def _period_value(current: float, previous: float) -> PeriodValue:
    """Zero-safe comparison logic, locked exactly as specified."""
    if previous == 0 and current == 0:
        return PeriodValue(current=current, previous=previous, change_percent=None, change_label="No activity in either period")
    if previous == 0 and current > 0:
        return PeriodValue(current=current, previous=previous, change_percent=None, change_label="New activity")
    if previous > 0 and current == 0:
        return PeriodValue(current=current, previous=previous, change_percent=-100.0, change_label="-100%")
    change_percent = round(((current - previous) / previous) * 100, 1)
    sign = "+" if change_percent >= 0 else ""
    return PeriodValue(current=current, previous=previous, change_percent=change_percent, change_label=f"{sign}{change_percent}%")


def get_executive_report(
    db: Session, current_user: User, preset: str, custom_start: date | None, custom_end: date | None
) -> ExecutiveReportResponse:
    hotel_ids, restaurant_ids = _resolve_scope(db, current_user)
    current_start, current_end, compare_start, compare_end = _resolve_period(preset, custom_start, custom_end)
    cur_from, cur_to = _to_datetime_bounds(current_start, current_end)
    prev_from, prev_to = _to_datetime_bounds(compare_start, compare_end)

    period_echo = ReportPeriodEcho(
        start=current_start, end=current_end,
        label=f"{current_start.isoformat()} to {current_end.isoformat()}",
        compare_start=compare_start, compare_end=compare_end,
    )

    # ---------- REVENUE ----------
    def revenue_in(dt_from: datetime, dt_to: datetime) -> float:
        q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.status == PaymentStatus.COMPLETED,
            Payment.paid_at >= dt_from,
            Payment.paid_at < dt_to,
        )
        return float(q.scalar() or 0)

    revenue = _period_value(revenue_in(cur_from, cur_to), revenue_in(prev_from, prev_to))

    # ---------- BOOKINGS CREATED ----------
    def bookings_in(dt_from: datetime, dt_to: datetime) -> float:
        q = (
            db.query(func.count(Booking.id))
            .join(Room, Booking.room_id == Room.id)
            .filter(Booking.created_at >= dt_from, Booking.created_at < dt_to, Booking.status != BookingStatus.CANCELLED)
        )
        if hotel_ids:
            q = q.filter(Room.hotel_id.in_(hotel_ids))
        return float(q.scalar() or 0)

    bookings_created = _period_value(bookings_in(cur_from, cur_to), bookings_in(prev_from, prev_to))

    # ---------- ORDERS CREATED (all statuses) + BY TYPE ----------
    def orders_row(dt_from: datetime, dt_to: datetime):
        q = db.query(
            func.count(Order.id).label("total"),
            func.count(case((Order.order_type == OrderType.DINE_IN, 1))).label("dine_in"),
            func.count(case((Order.order_type == OrderType.ROOM_SERVICE, 1))).label("room_service"),
            func.count(case((Order.order_type == OrderType.DELIVERY, 1))).label("delivery"),
        ).filter(Order.created_at >= dt_from, Order.created_at < dt_to)
        if restaurant_ids:
            q = q.filter(Order.restaurant_id.in_(restaurant_ids))
        return q.one()

    cur_orders = orders_row(cur_from, cur_to)
    prev_orders = orders_row(prev_from, prev_to)

    orders_created = _period_value(float(cur_orders.total or 0), float(prev_orders.total or 0))
    orders_by_type = OrdersByType(
        dine_in=_period_value(float(cur_orders.dine_in or 0), float(prev_orders.dine_in or 0)),
        room_service=_period_value(float(cur_orders.room_service or 0), float(prev_orders.room_service or 0)),
        delivery=_period_value(float(cur_orders.delivery or 0), float(prev_orders.delivery or 0)),
    )

    # ---------- FAILED PAYMENTS ----------
    def failed_payments_in(dt_from: datetime, dt_to: datetime) -> float:
        q = db.query(func.count(Payment.id)).filter(
            Payment.status == PaymentStatus.FAILED,
            Payment.created_at >= dt_from,
            Payment.created_at < dt_to,
        )
        return float(q.scalar() or 0)

    failed_payments = _period_value(failed_payments_in(cur_from, cur_to), failed_payments_in(prev_from, prev_to))

    # ---------- INVENTORY ACTIVITY ----------
    def inventory_scope_filter(q):
        if hotel_ids or restaurant_ids:
            from sqlalchemy import or_
            conditions = []
            if hotel_ids:
                conditions.append(InventoryItem.hotel_id.in_(hotel_ids))
            if restaurant_ids:
                conditions.append(InventoryItem.restaurant_id.in_(restaurant_ids))
            q = q.join(InventoryItem, StockTransaction.inventory_item_id == InventoryItem.id).filter(or_(*conditions))
        return q

    def inventory_total_in(dt_from: datetime, dt_to: datetime) -> float:
        q = db.query(func.count(StockTransaction.id)).filter(
            StockTransaction.created_at >= dt_from, StockTransaction.created_at < dt_to
        )
        q = inventory_scope_filter(q)
        return float(q.scalar() or 0)

    inventory_activity_total = _period_value(inventory_total_in(cur_from, cur_to), inventory_total_in(prev_from, prev_to))

    inv_by_type_query = db.query(
        StockTransaction.transaction_type, func.count(StockTransaction.id)
    ).filter(
        StockTransaction.created_at >= cur_from, StockTransaction.created_at < cur_to
    )
    inv_by_type_query = inventory_scope_filter(inv_by_type_query)
    inv_by_type_query = inv_by_type_query.group_by(StockTransaction.transaction_type)

    inv_counts = {t.value: 0 for t in TransactionType}
    for txn_type, count in inv_by_type_query.all():
        inv_counts[txn_type.value] = count

    inventory_activity_by_type = InventoryActivityByType(
        purchase=inv_counts.get("PURCHASE", 0),
        order_usage=inv_counts.get("ORDER_USAGE", 0),
        manual_adjustment=inv_counts.get("MANUAL_ADJUSTMENT", 0),
        waste=inv_counts.get("WASTE", 0),
        return_=inv_counts.get("RETURN", 0),
        service_usage=inv_counts.get("SERVICE_USAGE", 0),
    )

    # ---------- OVERDUE SERVICE REQUESTS (current snapshot, not period-based) ----------
    from app.services import dashboard_constants as dash_const
    escalation_cutoff = datetime.now(timezone.utc) - timedelta(minutes=dash_const.SERVICE_REQUEST_ESCALATION_MINUTES)
    overdue_count = db.query(func.count(ServiceRequest.id)).filter(
        ServiceRequest.status == ServiceRequestStatus.PENDING,
        ServiceRequest.created_at < escalation_cutoff,
    ).scalar() or 0

    return ExecutiveReportResponse(
        period=period_echo,
        revenue=revenue,
        bookings_created=bookings_created,
        orders_created=orders_created,
        orders_by_type=orders_by_type,
        failed_payments=failed_payments,
        inventory_activity_total=inventory_activity_total,
        inventory_activity_by_type=inventory_activity_by_type,
        overdue_service_requests_now=overdue_count,
    )