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
    change_label: str  # "+8.4%", "New activity", "No activity in either period", "-100%"


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