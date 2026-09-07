from pydantic import BaseModel


class OrdersTodayBreakdown(BaseModel):
    total: int
    dine_in: int
    room_service: int
    delivery: int


class HotelOverview(BaseModel):
    applicable: bool  # False when the manager/scope has no hotel at all
    current_occupancy_percent: float | None
    check_ins_today: int
    check_outs_today: int


class RestaurantOverview(BaseModel):
    applicable: bool
    orders_today: OrdersTodayBreakdown


class DeliveryOverview(BaseModel):
    applicable: bool
    active_deliveries: int


class InventoryOverview(BaseModel):
    applicable: bool
    low_stock_count: int


class FinancialOverview(BaseModel):
    revenue_today: float


class AttentionItem(BaseModel):
    category: str  # "service_request" | "failed_payment" | "low_stock"
    count: int
    label: str


class DashboardOverviewResponse(BaseModel):
    hotel: HotelOverview
    restaurant: RestaurantOverview
    delivery: DeliveryOverview
    inventory: InventoryOverview
    financial: FinancialOverview
    attention: list[AttentionItem]