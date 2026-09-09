from datetime import date
from pydantic import BaseModel, Field


class ReportPeriodEcho(BaseModel):
    start: date
    end: date
    label: str
    compare_start: date
    compare_end: date


class PeriodValue(BaseModel):
    current: float
    previous: float | None
    change_percent: float | None
    change_label: str


class OrdersByType(BaseModel):
    dine_in: PeriodValue
    room_service: PeriodValue
    delivery: PeriodValue


class InventoryActivityByType(BaseModel):
    purchase: int
    order_usage: int
    manual_adjustment: int
    waste: int
    return_: int = Field(serialization_alias="return")
    service_usage: int

    model_config = {"populate_by_name": True}


class ExecutiveReportResponse(BaseModel):
    period: ReportPeriodEcho
    revenue: PeriodValue
    bookings_created: PeriodValue
    orders_created: PeriodValue
    orders_by_type: OrdersByType
    failed_payments: PeriodValue
    inventory_activity_total: PeriodValue
    inventory_activity_by_type: InventoryActivityByType
    overdue_service_requests_now: int


# ---------- 17.2 Hotel ----------

class HotelReportResponse(BaseModel):
    applicable: bool
    period: ReportPeriodEcho
    bookings_created: PeriodValue
    check_ins_scheduled: PeriodValue
    check_outs_scheduled: PeriodValue
    room_night_demand: PeriodValue
    hotel_revenue: PeriodValue
    current_occupancy_percent: float | None  # snapshot, not period-based; None if no sellable rooms


# ---------- 17.3 Restaurant ----------

class RestaurantReportResponse(BaseModel):
    applicable: bool
    period: ReportPeriodEcho
    orders_created: PeriodValue
    orders_currently_served_created_in_period: PeriodValue
    orders_currently_cancelled_created_in_period: PeriodValue
    restaurant_revenue: PeriodValue
    average_order_value: float  # current period only; 0 if no served orders


# ---------- 17.3 Delivery ----------

class DeliveryReportResponse(BaseModel):
    applicable: bool
    period: ReportPeriodEcho
    deliveries_created: PeriodValue
    deliveries_delivered_in_period: PeriodValue
    deliveries_currently_cancelled_created_in_period: PeriodValue
    average_completion_minutes: float | None  # None if no completed deliveries with both timestamps


# ---------- 17.3 Inventory ----------

class InventoryReportResponse(BaseModel):
    applicable: bool
    period: ReportPeriodEcho
    inventory_activity_total: PeriodValue
    inventory_activity_by_type: InventoryActivityByType
    low_stock_items_now: int  # snapshot


# ---------- 17.3 Operations ----------

class StatusCount(BaseModel):
    status: str
    count: int


class OperationsReportResponse(BaseModel):
    period: ReportPeriodEcho
    service_requests_created: PeriodValue
    service_requests_completed: PeriodValue
    service_requests_overdue_now: int  # snapshot
    orders_backlog_now: list[StatusCount]  # snapshot, excludes SERVED/CANCELLED
    deliveries_backlog_now: list[StatusCount]  # snapshot, excludes DELIVERED/CANCELLED
    payments_completed: PeriodValue
    payments_failed: PeriodValue
    payments_pending: PeriodValue