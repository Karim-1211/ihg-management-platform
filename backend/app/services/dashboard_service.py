from datetime import datetime, timezone, timedelta

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.hotel import Booking, BookingStatus, Room, RoomStatus
from app.models.restaurant import Order, OrderType, Restaurant
from app.models.delivery import Delivery, DeliveryStatus
from app.models.inventory import InventoryItem
from app.models.billing import Payment, PaymentStatus
from app.models.service_request import ServiceRequest, ServiceRequestStatus
from app.models.user import User, RoleEnum
from app.schemas.dashboard import (
    DashboardOverviewResponse, HotelOverview, RestaurantOverview,
    DeliveryOverview, InventoryOverview, FinancialOverview,
    OrdersTodayBreakdown, AttentionItem,
)
from app.services import dashboard_constants as const


def _today_utc_bounds() -> tuple[datetime, datetime]:
    """'Today' = UTC calendar day, per the locked Phase 16.1 decision.
    Documented demo/assumed policy — see dashboard_constants.py."""
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def _resolve_scope(db: Session, current_user: User) -> tuple[list, list]:
    """Returns (hotel_ids, restaurant_ids) the current user is authorized to
    see. SUPER_ADMIN sees everything (empty list = no filter). MANAGER is
    scoped to their own hotel_id, plus any restaurant belonging to that hotel."""
    if current_user.role == RoleEnum.SUPER_ADMIN:
        return [], []  # empty = unfiltered / global

    if current_user.role == RoleEnum.MANAGER:
        hotel_ids = [current_user.hotel_id] if current_user.hotel_id else []
        restaurant_ids = [
            r.id for r in db.query(Restaurant.id).filter(Restaurant.hotel_id.in_(hotel_ids)).all()
        ] if hotel_ids else []
        # A manager's own restaurant_id (if directly assigned) is also included.
        if current_user.restaurant_id and current_user.restaurant_id not in restaurant_ids:
            restaurant_ids.append(current_user.restaurant_id)
        return hotel_ids, restaurant_ids

    # Should not be reached — router restricts to SUPER_ADMIN/MANAGER only.
    return [], []


def get_dashboard_overview(db: Session, current_user: User) -> DashboardOverviewResponse:
    hotel_ids, restaurant_ids = _resolve_scope(db, current_user)
    today_start, today_end = _today_utc_bounds()

    # ---------- HOTEL ----------
    room_query = db.query(Room).filter(Room.status.notin_([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE]))
    if hotel_ids:
        room_query = room_query.filter(Room.hotel_id.in_(hotel_ids))
    sellable_rooms = room_query.count()

    hotel_applicable = sellable_rooms > 0 or bool(hotel_ids) or current_user.role == RoleEnum.SUPER_ADMIN

    occupancy_percent = None
    check_ins_today = 0
    check_outs_today = 0

    if sellable_rooms > 0:
        now = datetime.now(timezone.utc)
        today_date = now.date()

        occupied_query = (
            db.query(func.count(func.distinct(Booking.room_id)))
            .join(Room, Booking.room_id == Room.id)
            .filter(
                Booking.status == BookingStatus.CHECKED_IN,
                Booking.check_in_date <= today_date,
                Booking.check_out_date > today_date,
                Room.status.notin_([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE]),
            )
        )
        if hotel_ids:
            occupied_query = occupied_query.filter(Room.hotel_id.in_(hotel_ids))
        occupied_rooms = occupied_query.scalar() or 0
        occupancy_percent = round((occupied_rooms / sellable_rooms) * 100, 1)

        checkins_query = (
            db.query(func.count(Booking.id))
            .join(Room, Booking.room_id == Room.id)
            .filter(Booking.check_in_date == today_date, Booking.status != BookingStatus.CANCELLED)
        )
        if hotel_ids:
            checkins_query = checkins_query.filter(Room.hotel_id.in_(hotel_ids))
        check_ins_today = checkins_query.scalar() or 0

        checkouts_query = (
            db.query(func.count(Booking.id))
            .join(Room, Booking.room_id == Room.id)
            .filter(Booking.check_out_date == today_date, Booking.status != BookingStatus.CANCELLED)
        )
        if hotel_ids:
            checkouts_query = checkouts_query.filter(Room.hotel_id.in_(hotel_ids))
        check_outs_today = checkouts_query.scalar() or 0

    hotel = HotelOverview(
        applicable=hotel_applicable,
        current_occupancy_percent=occupancy_percent,
        check_ins_today=check_ins_today,
        check_outs_today=check_outs_today,
    )

    # ---------- RESTAURANT ----------
    order_query = db.query(
        func.count(Order.id).label("total"),
        func.count(case((Order.order_type == OrderType.DINE_IN, 1))).label("dine_in"),
        func.count(case((Order.order_type == OrderType.ROOM_SERVICE, 1))).label("room_service"),
        func.count(case((Order.order_type == OrderType.DELIVERY, 1))).label("delivery"),
    ).filter(Order.created_at >= today_start, Order.created_at < today_end)
    if restaurant_ids:
        order_query = order_query.filter(Order.restaurant_id.in_(restaurant_ids))
    order_row = order_query.one()

    restaurant_applicable = bool(restaurant_ids) or current_user.role == RoleEnum.SUPER_ADMIN
    restaurant = RestaurantOverview(
        applicable=restaurant_applicable,
        orders_today=OrdersTodayBreakdown(
            total=order_row.total or 0,
            dine_in=order_row.dine_in or 0,
            room_service=order_row.room_service or 0,
            delivery=order_row.delivery or 0,
        ),
    )

    # ---------- DELIVERY ----------
    delivery_query = (
        db.query(func.count(Delivery.id))
        .join(Order, Delivery.order_id == Order.id)
        .filter(Delivery.status.notin_([DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED]))
    )
    if restaurant_ids:
        delivery_query = delivery_query.filter(Order.restaurant_id.in_(restaurant_ids))
    active_deliveries = delivery_query.scalar() or 0

    delivery = DeliveryOverview(applicable=restaurant_applicable, active_deliveries=active_deliveries)

    # ---------- INVENTORY ----------
    # Uses the same authoritative low-stock definition as inventory_service.py's
    # _attach_low_stock_flag: current_quantity <= minimum_quantity.
    inv_query = db.query(func.count(InventoryItem.id)).filter(
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
        inv_query = inv_query.filter(or_(*conditions))
    low_stock_count = inv_query.scalar() or 0

    inventory = InventoryOverview(
        applicable=hotel_applicable or restaurant_applicable,
        low_stock_count=low_stock_count,
    )

    # ---------- FINANCIAL ----------
    # Revenue Today = COMPLETED payments only, filtered by paid_at (never
    # created_at), within today's UTC calendar day. See dashboard_constants.py.
    revenue_query = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.status == PaymentStatus.COMPLETED,
        Payment.paid_at >= today_start,
        Payment.paid_at < today_end,
    )
    # Note: scoping Payment by hotel/restaurant requires joining through Invoice;
    # deferred to keep this slice's query count bounded. SUPER_ADMIN sees global
    # revenue in 16.1; per-scope revenue filtering is a 16.1b/17 refinement.
    revenue_today = float(revenue_query.scalar() or 0)

    financial = FinancialOverview(revenue_today=revenue_today)

    # ---------- ATTENTION ----------
    attention: list[AttentionItem] = []

    escalation_cutoff = datetime.now(timezone.utc) - timedelta(minutes=const.SERVICE_REQUEST_ESCALATION_MINUTES)
    overdue_query = db.query(func.count(ServiceRequest.id)).filter(
        ServiceRequest.status == ServiceRequestStatus.PENDING,
        ServiceRequest.created_at < escalation_cutoff,
    )
    overdue_count = overdue_query.scalar() or 0
    if overdue_count > 0:
        attention.append(AttentionItem(
            category="service_request",
            count=overdue_count,
            label=f"{overdue_count} service request(s) pending over {const.SERVICE_REQUEST_ESCALATION_MINUTES} minutes",
        ))

    failed_cutoff = datetime.now(timezone.utc) - timedelta(hours=const.FAILED_PAYMENT_LOOKBACK_HOURS)
    failed_query = db.query(func.count(Payment.id)).filter(
        Payment.status == PaymentStatus.FAILED,
        Payment.created_at >= failed_cutoff,
    )
    failed_count = failed_query.scalar() or 0
    if failed_count > 0:
        attention.append(AttentionItem(
            category="failed_payment",
            count=failed_count,
            label=f"{failed_count} payment(s) failed in the last {const.FAILED_PAYMENT_LOOKBACK_HOURS} hours",
        ))

    if low_stock_count > 0:
        attention.append(AttentionItem(
            category="low_stock",
            count=low_stock_count,
            label=f"{low_stock_count} inventory item(s) below minimum stock",
        ))

    return DashboardOverviewResponse(
        hotel=hotel,
        restaurant=restaurant,
        delivery=delivery,
        inventory=inventory,
        financial=financial,
        attention=attention,
    )