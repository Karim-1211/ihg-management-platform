import uuid
from datetime import date, datetime, timezone, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.hotel import Booking, BookingStatus, Room, RoomStatus
from app.models.restaurant import Order, OrderType, OrderStatus, Restaurant
from app.models.delivery import Delivery, DeliveryStatus
from app.models.billing import Payment, PaymentStatus, Invoice, InvoiceType
from app.models.inventory import InventoryItem, StockTransaction, TransactionType
from app.models.service_request import ServiceRequest, ServiceRequestStatus
from app.models.user import User, RoleEnum
from app.schemas.reports import (
    ExecutiveReportResponse, ReportPeriodEcho, PeriodValue,
    OrdersByType, InventoryActivityByType,
    HotelReportResponse, RestaurantReportResponse, DeliveryReportResponse,
    InventoryReportResponse, OperationsReportResponse, StatusCount,
)
from app.services import report_constants as const
from app.services import business_rule_service


def _resolve_scope(db: Session, current_user: User) -> tuple[list, list]:
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
    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    end_dt = datetime(end.year, end.month, end.day, tzinfo=timezone.utc) + timedelta(days=1)
    return start_dt, end_dt


def _period_value(current: float, previous: float) -> PeriodValue:
    if previous == 0 and current == 0:
        return PeriodValue(current=current, previous=previous, change_percent=None, change_label="No activity in either period")
    if previous == 0 and current > 0:
        return PeriodValue(current=current, previous=previous, change_percent=None, change_label="New activity")
    if previous > 0 and current == 0:
        return PeriodValue(current=current, previous=previous, change_percent=-100.0, change_label="-100%")
    change_percent = round(((current - previous) / previous) * 100, 1)
    sign = "+" if change_percent >= 0 else ""
    return PeriodValue(current=current, previous=previous, change_percent=change_percent, change_label=f"{sign}{change_percent}%")


def _period_echo(current_start, current_end, compare_start, compare_end) -> ReportPeriodEcho:
    return ReportPeriodEcho(
        start=current_start, end=current_end,
        label=f"{current_start.isoformat()} to {current_end.isoformat()}",
        compare_start=compare_start, compare_end=compare_end,
    )


def get_executive_report(
    db: Session, current_user: User, preset: str, custom_start: date | None, custom_end: date | None
) -> ExecutiveReportResponse:
    hotel_ids, restaurant_ids = _resolve_scope(db, current_user)
    current_start, current_end, compare_start, compare_end = _resolve_period(preset, custom_start, custom_end)
    cur_from, cur_to = _to_datetime_bounds(current_start, current_end)
    prev_from, prev_to = _to_datetime_bounds(compare_start, compare_end)
    period_echo = _period_echo(current_start, current_end, compare_start, compare_end)

    def revenue_in(dt_from, dt_to):
        q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.status == PaymentStatus.COMPLETED, Payment.paid_at >= dt_from, Payment.paid_at < dt_to,
        )
        return float(q.scalar() or 0)

    revenue = _period_value(revenue_in(cur_from, cur_to), revenue_in(prev_from, prev_to))

    def bookings_in(dt_from, dt_to):
        q = (
            db.query(func.count(Booking.id)).join(Room, Booking.room_id == Room.id)
            .filter(Booking.created_at >= dt_from, Booking.created_at < dt_to, Booking.status != BookingStatus.CANCELLED)
        )
        if hotel_ids:
            q = q.filter(Room.hotel_id.in_(hotel_ids))
        return float(q.scalar() or 0)

    bookings_created = _period_value(bookings_in(cur_from, cur_to), bookings_in(prev_from, prev_to))

    def orders_row(dt_from, dt_to):
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

    def failed_payments_in(dt_from, dt_to):
        q = db.query(func.count(Payment.id)).filter(
            Payment.status == PaymentStatus.FAILED, Payment.created_at >= dt_from, Payment.created_at < dt_to,
        )
        return float(q.scalar() or 0)

    failed_payments = _period_value(failed_payments_in(cur_from, cur_to), failed_payments_in(prev_from, prev_to))

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

    def inventory_total_in(dt_from, dt_to):
        q = db.query(func.count(StockTransaction.id)).filter(
            StockTransaction.created_at >= dt_from, StockTransaction.created_at < dt_to
        )
        return float(inventory_scope_filter(q).scalar() or 0)

    inventory_activity_total = _period_value(inventory_total_in(cur_from, cur_to), inventory_total_in(prev_from, prev_to))

    inv_by_type_query = db.query(StockTransaction.transaction_type, func.count(StockTransaction.id)).filter(
        StockTransaction.created_at >= cur_from, StockTransaction.created_at < cur_to
    )
    inv_by_type_query = inventory_scope_filter(inv_by_type_query).group_by(StockTransaction.transaction_type)
    inv_counts = {t.value: 0 for t in TransactionType}
    for txn_type, count in inv_by_type_query.all():
        inv_counts[txn_type.value] = count
    inventory_activity_by_type = InventoryActivityByType(
        purchase=inv_counts.get("PURCHASE", 0), order_usage=inv_counts.get("ORDER_USAGE", 0),
        manual_adjustment=inv_counts.get("MANUAL_ADJUSTMENT", 0), waste=inv_counts.get("WASTE", 0),
        return_=inv_counts.get("RETURN", 0), service_usage=inv_counts.get("SERVICE_USAGE", 0),
    )

    escalation_cutoff = datetime.now(timezone.utc) - timedelta(
        minutes=business_rule_service.get_service_request_escalation_minutes(db)
    )
    overdue_count = db.query(func.count(ServiceRequest.id)).filter(
        ServiceRequest.status == ServiceRequestStatus.PENDING, ServiceRequest.created_at < escalation_cutoff,
    ).scalar() or 0

    return ExecutiveReportResponse(
        period=period_echo, revenue=revenue, bookings_created=bookings_created,
        orders_created=orders_created, orders_by_type=orders_by_type, failed_payments=failed_payments,
        inventory_activity_total=inventory_activity_total, inventory_activity_by_type=inventory_activity_by_type,
        overdue_service_requests_now=overdue_count,
    )


# ---------- 17.2 Hotel ----------

def get_hotel_report(db: Session, current_user: User, preset: str, custom_start: date | None, custom_end: date | None) -> HotelReportResponse:
    hotel_ids, _ = _resolve_scope(db, current_user)
    current_start, current_end, compare_start, compare_end = _resolve_period(preset, custom_start, custom_end)
    cur_from, cur_to = _to_datetime_bounds(current_start, current_end)
    prev_from, prev_to = _to_datetime_bounds(compare_start, compare_end)
    period_echo = _period_echo(current_start, current_end, compare_start, compare_end)

    room_query = db.query(Room).filter(Room.status.notin_([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE]))
    if hotel_ids:
        room_query = room_query.filter(Room.hotel_id.in_(hotel_ids))
    sellable_rooms = room_query.count()
    applicable = sellable_rooms > 0 or bool(hotel_ids) or current_user.role == RoleEnum.SUPER_ADMIN

    if not applicable:
        return HotelReportResponse(
            applicable=False, period=period_echo,
            bookings_created=_period_value(0, 0), check_ins_scheduled=_period_value(0, 0),
            check_outs_scheduled=_period_value(0, 0), room_night_demand=_period_value(0, 0),
            hotel_revenue=_period_value(0, 0), current_occupancy_percent=None,
        )

    def bookings_created_in(dt_from, dt_to):
        q = db.query(func.count(Booking.id)).join(Room, Booking.room_id == Room.id).filter(
            Booking.created_at >= dt_from, Booking.created_at < dt_to, Booking.status != BookingStatus.CANCELLED,
        )
        if hotel_ids:
            q = q.filter(Room.hotel_id.in_(hotel_ids))
        return float(q.scalar() or 0)

    bookings_created = _period_value(bookings_created_in(cur_from, cur_to), bookings_created_in(prev_from, prev_to))

    def check_ins_scheduled_in(d_from: date, d_to: date):
        q = db.query(func.count(Booking.id)).join(Room, Booking.room_id == Room.id).filter(
            Booking.check_in_date >= d_from, Booking.check_in_date <= d_to, Booking.status != BookingStatus.CANCELLED,
        )
        if hotel_ids:
            q = q.filter(Room.hotel_id.in_(hotel_ids))
        return float(q.scalar() or 0)

    check_ins_scheduled = _period_value(check_ins_scheduled_in(current_start, current_end), check_ins_scheduled_in(compare_start, compare_end))

    def check_outs_scheduled_in(d_from: date, d_to: date):
        q = db.query(func.count(Booking.id)).join(Room, Booking.room_id == Room.id).filter(
            Booking.check_out_date >= d_from, Booking.check_out_date <= d_to, Booking.status != BookingStatus.CANCELLED,
        )
        if hotel_ids:
            q = q.filter(Room.hotel_id.in_(hotel_ids))
        return float(q.scalar() or 0)

    check_outs_scheduled = _period_value(check_outs_scheduled_in(current_start, current_end), check_outs_scheduled_in(compare_start, compare_end))

    def room_night_demand_in(d_from: date, d_to: date):
        q = db.query(Booking.check_in_date, Booking.check_out_date).join(Room, Booking.room_id == Room.id).filter(
            Booking.status != BookingStatus.CANCELLED,
            Booking.check_in_date < (d_to + timedelta(days=1)),
            Booking.check_out_date > d_from,
        )
        if hotel_ids:
            q = q.filter(Room.hotel_id.in_(hotel_ids))
        total_nights = 0
        for check_in, check_out in q.all():
            overlap_start = max(check_in, d_from)
            overlap_end = min(check_out, d_to + timedelta(days=1))
            nights = (overlap_end - overlap_start).days
            if nights > 0:
                total_nights += nights
        return float(total_nights)

    room_night_demand = _period_value(room_night_demand_in(current_start, current_end), room_night_demand_in(compare_start, compare_end))

    def hotel_revenue_in(dt_from, dt_to):
        q = db.query(func.coalesce(func.sum(Payment.amount), 0)).join(Invoice, Payment.invoice_id == Invoice.id).filter(
            Payment.status == PaymentStatus.COMPLETED, Payment.paid_at >= dt_from, Payment.paid_at < dt_to,
            Invoice.invoice_type == InvoiceType.HOTEL,
        )
        return float(q.scalar() or 0)

    hotel_revenue = _period_value(hotel_revenue_in(cur_from, cur_to), hotel_revenue_in(prev_from, prev_to))

    now = datetime.now(timezone.utc)
    today_date = now.date()
    occ_q = (
        db.query(func.count(func.distinct(Booking.room_id))).join(Room, Booking.room_id == Room.id)
        .filter(
            Booking.status == BookingStatus.CHECKED_IN, Booking.check_in_date <= today_date, Booking.check_out_date > today_date,
            Room.status.notin_([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE]),
        )
    )
    if hotel_ids:
        occ_q = occ_q.filter(Room.hotel_id.in_(hotel_ids))
    occupied_rooms = occ_q.scalar() or 0
    current_occupancy_percent = round((occupied_rooms / sellable_rooms) * 100, 1) if sellable_rooms > 0 else None

    return HotelReportResponse(
        applicable=True, period=period_echo, bookings_created=bookings_created,
        check_ins_scheduled=check_ins_scheduled, check_outs_scheduled=check_outs_scheduled,
        room_night_demand=room_night_demand, hotel_revenue=hotel_revenue,
        current_occupancy_percent=current_occupancy_percent,
    )


# ---------- 17.3 Restaurant ----------

def get_restaurant_report(db: Session, current_user: User, preset: str, custom_start: date | None, custom_end: date | None) -> RestaurantReportResponse:
    _, restaurant_ids = _resolve_scope(db, current_user)
    current_start, current_end, compare_start, compare_end = _resolve_period(preset, custom_start, custom_end)
    cur_from, cur_to = _to_datetime_bounds(current_start, current_end)
    prev_from, prev_to = _to_datetime_bounds(compare_start, compare_end)
    period_echo = _period_echo(current_start, current_end, compare_start, compare_end)

    applicable = bool(restaurant_ids) or current_user.role == RoleEnum.SUPER_ADMIN
    if not applicable:
        return RestaurantReportResponse(
            applicable=False, period=period_echo, orders_created=_period_value(0, 0),
            orders_currently_served_created_in_period=_period_value(0, 0),
            orders_currently_cancelled_created_in_period=_period_value(0, 0),
            restaurant_revenue=_period_value(0, 0), average_order_value=0,
        )

    def orders_row(dt_from, dt_to):
        q = db.query(
            func.count(Order.id).label("total"),
            func.count(case((Order.status == OrderStatus.SERVED, 1))).label("served"),
            func.count(case((Order.status == OrderStatus.CANCELLED, 1))).label("cancelled"),
        ).filter(Order.created_at >= dt_from, Order.created_at < dt_to)
        if restaurant_ids:
            q = q.filter(Order.restaurant_id.in_(restaurant_ids))
        return q.one()

    cur_o, prev_o = orders_row(cur_from, cur_to), orders_row(prev_from, prev_to)
    orders_created = _period_value(float(cur_o.total or 0), float(prev_o.total or 0))
    orders_served = _period_value(float(cur_o.served or 0), float(prev_o.served or 0))
    orders_cancelled = _period_value(float(cur_o.cancelled or 0), float(prev_o.cancelled or 0))

    def restaurant_revenue_in(dt_from, dt_to):
        q = db.query(func.coalesce(func.sum(Payment.amount), 0)).join(Invoice, Payment.invoice_id == Invoice.id).filter(
            Payment.status == PaymentStatus.COMPLETED, Payment.paid_at >= dt_from, Payment.paid_at < dt_to,
            Invoice.invoice_type == InvoiceType.RESTAURANT,
        )
        if restaurant_ids:
            q = q.filter(Invoice.restaurant_id.in_(restaurant_ids))
        return float(q.scalar() or 0)

    restaurant_revenue = _period_value(restaurant_revenue_in(cur_from, cur_to), restaurant_revenue_in(prev_from, prev_to))
    average_order_value = round(restaurant_revenue.current / cur_o.served, 2) if cur_o.served else 0.0

    return RestaurantReportResponse(
        applicable=True, period=period_echo, orders_created=orders_created,
        orders_currently_served_created_in_period=orders_served,
        orders_currently_cancelled_created_in_period=orders_cancelled,
        restaurant_revenue=restaurant_revenue, average_order_value=average_order_value,
    )


# ---------- 17.3 Delivery ----------

def get_delivery_report(db: Session, current_user: User, preset: str, custom_start: date | None, custom_end: date | None) -> DeliveryReportResponse:
    _, restaurant_ids = _resolve_scope(db, current_user)
    current_start, current_end, compare_start, compare_end = _resolve_period(preset, custom_start, custom_end)
    cur_from, cur_to = _to_datetime_bounds(current_start, current_end)
    prev_from, prev_to = _to_datetime_bounds(compare_start, compare_end)
    period_echo = _period_echo(current_start, current_end, compare_start, compare_end)

    applicable = bool(restaurant_ids) or current_user.role == RoleEnum.SUPER_ADMIN
    if not applicable:
        return DeliveryReportResponse(
            applicable=False, period=period_echo, deliveries_created=_period_value(0, 0),
            deliveries_delivered_in_period=_period_value(0, 0),
            deliveries_currently_cancelled_created_in_period=_period_value(0, 0),
            average_completion_minutes=None,
        )

    def created_in(dt_from, dt_to):
        q = db.query(func.count(Delivery.id)).join(Order, Delivery.order_id == Order.id).filter(
            Delivery.created_at >= dt_from, Delivery.created_at < dt_to,
        )
        if restaurant_ids:
            q = q.filter(Order.restaurant_id.in_(restaurant_ids))
        return float(q.scalar() or 0)

    deliveries_created = _period_value(created_in(cur_from, cur_to), created_in(prev_from, prev_to))

    def delivered_in(dt_from, dt_to):
        q = db.query(func.count(Delivery.id)).join(Order, Delivery.order_id == Order.id).filter(
            Delivery.delivered_at.isnot(None), Delivery.delivered_at >= dt_from, Delivery.delivered_at < dt_to,
        )
        if restaurant_ids:
            q = q.filter(Order.restaurant_id.in_(restaurant_ids))
        return float(q.scalar() or 0)

    deliveries_delivered = _period_value(delivered_in(cur_from, cur_to), delivered_in(prev_from, prev_to))

    def cancelled_created_in(dt_from, dt_to):
        q = db.query(func.count(Delivery.id)).join(Order, Delivery.order_id == Order.id).filter(
            Delivery.status == DeliveryStatus.CANCELLED, Delivery.created_at >= dt_from, Delivery.created_at < dt_to,
        )
        if restaurant_ids:
            q = q.filter(Order.restaurant_id.in_(restaurant_ids))
        return float(q.scalar() or 0)

    deliveries_cancelled = _period_value(cancelled_created_in(cur_from, cur_to), cancelled_created_in(prev_from, prev_to))

    avg_q = db.query(
        func.avg(func.extract("epoch", Delivery.delivered_at - Delivery.assigned_at) / 60.0)
    ).join(Order, Delivery.order_id == Order.id).filter(
        Delivery.delivered_at.isnot(None), Delivery.assigned_at.isnot(None),
        Delivery.delivered_at >= cur_from, Delivery.delivered_at < cur_to,
    )
    if restaurant_ids:
        avg_q = avg_q.filter(Order.restaurant_id.in_(restaurant_ids))
    avg_result = avg_q.scalar()
    average_completion_minutes = round(float(avg_result), 1) if avg_result is not None else None

    return DeliveryReportResponse(
        applicable=True, period=period_echo, deliveries_created=deliveries_created,
        deliveries_delivered_in_period=deliveries_delivered,
        deliveries_currently_cancelled_created_in_period=deliveries_cancelled,
        average_completion_minutes=average_completion_minutes,
    )


# ---------- 17.3 Inventory ----------

def get_inventory_report(db: Session, current_user: User, preset: str, custom_start: date | None, custom_end: date | None) -> InventoryReportResponse:
    hotel_ids, restaurant_ids = _resolve_scope(db, current_user)
    current_start, current_end, compare_start, compare_end = _resolve_period(preset, custom_start, custom_end)
    cur_from, cur_to = _to_datetime_bounds(current_start, current_end)
    prev_from, prev_to = _to_datetime_bounds(compare_start, compare_end)
    period_echo = _period_echo(current_start, current_end, compare_start, compare_end)

    applicable = bool(hotel_ids) or bool(restaurant_ids) or current_user.role == RoleEnum.SUPER_ADMIN

    def scope_filter(q):
        if hotel_ids or restaurant_ids:
            from sqlalchemy import or_
            conditions = []
            if hotel_ids:
                conditions.append(InventoryItem.hotel_id.in_(hotel_ids))
            if restaurant_ids:
                conditions.append(InventoryItem.restaurant_id.in_(restaurant_ids))
            q = q.join(InventoryItem, StockTransaction.inventory_item_id == InventoryItem.id).filter(or_(*conditions))
        return q

    def total_in(dt_from, dt_to):
        q = db.query(func.count(StockTransaction.id)).filter(
            StockTransaction.created_at >= dt_from, StockTransaction.created_at < dt_to
        )
        return float(scope_filter(q).scalar() or 0)

    inventory_activity_total = _period_value(total_in(cur_from, cur_to), total_in(prev_from, prev_to))

    by_type_q = db.query(StockTransaction.transaction_type, func.count(StockTransaction.id)).filter(
        StockTransaction.created_at >= cur_from, StockTransaction.created_at < cur_to
    )
    by_type_q = scope_filter(by_type_q).group_by(StockTransaction.transaction_type)
    counts = {t.value: 0 for t in TransactionType}
    for txn_type, count in by_type_q.all():
        counts[txn_type.value] = count
    inventory_activity_by_type = InventoryActivityByType(
        purchase=counts.get("PURCHASE", 0), order_usage=counts.get("ORDER_USAGE", 0),
        manual_adjustment=counts.get("MANUAL_ADJUSTMENT", 0), waste=counts.get("WASTE", 0),
        return_=counts.get("RETURN", 0), service_usage=counts.get("SERVICE_USAGE", 0),
    )

    low_stock_q = db.query(func.count(InventoryItem.id)).filter(
        InventoryItem.is_active == True,  # noqa: E712
        InventoryItem.current_quantity <= InventoryItem.minimum_quantity,
    )
    if hotel_ids or restaurant_ids:
        from sqlalchemy import or_
        conditions = []
        if hotel_ids:
            conditions.append(InventoryItem.hotel_id.in_(hotel_ids))
        if restaurant_ids:
            conditions.append(InventoryItem.restaurant_id.in_(restaurant_ids))
        low_stock_q = low_stock_q.filter(or_(*conditions))
    low_stock_items_now = low_stock_q.scalar() or 0

    return InventoryReportResponse(
        applicable=applicable, period=period_echo, inventory_activity_total=inventory_activity_total,
        inventory_activity_by_type=inventory_activity_by_type, low_stock_items_now=low_stock_items_now,
    )


# ---------- 17.3 Operations ----------

def get_operations_report(db: Session, current_user: User, preset: str, custom_start: date | None, custom_end: date | None) -> OperationsReportResponse:
    hotel_ids, restaurant_ids = _resolve_scope(db, current_user)
    current_start, current_end, compare_start, compare_end = _resolve_period(preset, custom_start, custom_end)
    cur_from, cur_to = _to_datetime_bounds(current_start, current_end)
    prev_from, prev_to = _to_datetime_bounds(compare_start, compare_end)
    period_echo = _period_echo(current_start, current_end, compare_start, compare_end)

    def sr_created_in(dt_from, dt_to):
        from app.models.hotel import Booking as BookingModel, Room as RoomModel
        q = db.query(func.count(ServiceRequest.id)).join(BookingModel, ServiceRequest.booking_id == BookingModel.id).join(
            RoomModel, BookingModel.room_id == RoomModel.id
        ).filter(ServiceRequest.created_at >= dt_from, ServiceRequest.created_at < dt_to)
        if hotel_ids:
            q = q.filter(RoomModel.hotel_id.in_(hotel_ids))
        return float(q.scalar() or 0)

    service_requests_created = _period_value(sr_created_in(cur_from, cur_to), sr_created_in(prev_from, prev_to))

    def sr_completed_in(dt_from, dt_to):
        from app.models.hotel import Booking as BookingModel, Room as RoomModel
        q = db.query(func.count(ServiceRequest.id)).join(BookingModel, ServiceRequest.booking_id == BookingModel.id).join(
            RoomModel, BookingModel.room_id == RoomModel.id
        ).filter(
            ServiceRequest.status == ServiceRequestStatus.COMPLETED,
            ServiceRequest.completed_at.isnot(None),
            ServiceRequest.completed_at >= dt_from, ServiceRequest.completed_at < dt_to,
        )
        if hotel_ids:
            q = q.filter(RoomModel.hotel_id.in_(hotel_ids))
        return float(q.scalar() or 0)

    service_requests_completed = _period_value(sr_completed_in(cur_from, cur_to), sr_completed_in(prev_from, prev_to))

    escalation_cutoff = datetime.now(timezone.utc) - timedelta(
        minutes=business_rule_service.get_service_request_escalation_minutes(db)
    )
    overdue_now = db.query(func.count(ServiceRequest.id)).filter(
        ServiceRequest.status == ServiceRequestStatus.PENDING, ServiceRequest.created_at < escalation_cutoff,
    ).scalar() or 0

    orders_backlog_q = db.query(Order.status, func.count(Order.id)).filter(
        Order.status.notin_([OrderStatus.SERVED, OrderStatus.CANCELLED])
    )
    if restaurant_ids:
        orders_backlog_q = orders_backlog_q.filter(Order.restaurant_id.in_(restaurant_ids))
    orders_backlog_now = [
        StatusCount(status=s.value, count=c) for s, c in orders_backlog_q.group_by(Order.status).all()
    ]

    deliveries_backlog_q = db.query(Delivery.status, func.count(Delivery.id)).join(Order, Delivery.order_id == Order.id).filter(
        Delivery.status.notin_([DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED])
    )
    if restaurant_ids:
        deliveries_backlog_q = deliveries_backlog_q.filter(Order.restaurant_id.in_(restaurant_ids))
    deliveries_backlog_now = [
        StatusCount(status=s.value, count=c) for s, c in deliveries_backlog_q.group_by(Delivery.status).all()
    ]

    def payments_by_status_in(target_status: PaymentStatus, dt_from, dt_to):
        q = db.query(func.count(Payment.id)).filter(
            Payment.status == target_status, Payment.created_at >= dt_from, Payment.created_at < dt_to,
        )
        return float(q.scalar() or 0)

    payments_completed = _period_value(
        payments_by_status_in(PaymentStatus.COMPLETED, cur_from, cur_to),
        payments_by_status_in(PaymentStatus.COMPLETED, prev_from, prev_to),
    )
    payments_failed = _period_value(
        payments_by_status_in(PaymentStatus.FAILED, cur_from, cur_to),
        payments_by_status_in(PaymentStatus.FAILED, prev_from, prev_to),
    )
    payments_pending = _period_value(
        payments_by_status_in(PaymentStatus.PENDING, cur_from, cur_to),
        payments_by_status_in(PaymentStatus.PENDING, prev_from, prev_to),
    )

    return OperationsReportResponse(
        period=period_echo, service_requests_created=service_requests_created,
        service_requests_completed=service_requests_completed, service_requests_overdue_now=overdue_now,
        orders_backlog_now=orders_backlog_now, deliveries_backlog_now=deliveries_backlog_now,
        payments_completed=payments_completed, payments_failed=payments_failed, payments_pending=payments_pending,
    )