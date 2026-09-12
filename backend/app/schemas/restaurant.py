import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.hotel import RoomStatus, BookingStatus, HousekeepingStatus
from app.models.restaurant import TableStatus, ReservationStatus, OrderType, OrderStatus


# ---------- Restaurant ----------

class RestaurantCreate(BaseModel):
    hotel_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None


class RestaurantResponse(BaseModel):
    id: uuid.UUID
    hotel_id: uuid.UUID | None
    name: str
    description: str | None
    address: str | None
    phone: str | None
    email: str | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Tables ----------

class RestaurantTableCreate(BaseModel):
    restaurant_id: uuid.UUID
    table_number: str = Field(min_length=1, max_length=20)
    capacity: int = Field(ge=1, default=2)


class RestaurantTableResponse(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    table_number: str
    capacity: int
    status: TableStatus

    model_config = ConfigDict(from_attributes=True)


class TableStatusUpdate(BaseModel):
    status: TableStatus


# ---------- Menu ----------

class MenuCategoryCreate(BaseModel):
    restaurant_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    display_order: int = Field(default=0)


class MenuCategoryResponse(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    name: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class MenuItemCreate(BaseModel):
    category_id: uuid.UUID
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    price: float = Field(gt=0)
    image_url: str | None = None


class MenuItemResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    description: str | None
    price: float
    image_url: str | None
    is_available: bool

    model_config = ConfigDict(from_attributes=True)


class MenuItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    image_url: str | None = None
    is_available: bool | None = None


class MenuWithItemsResponse(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    name: str
    display_order: int
    items: list[MenuItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------- Table Reservations ----------

class TableReservationCreate(BaseModel):
    table_id: uuid.UUID
    reservation_start: datetime
    reservation_end: datetime | None = None
    party_size: int = Field(ge=1, default=2)
    notes: str | None = None


class TableReservationResponse(BaseModel):
    id: uuid.UUID
    table_id: uuid.UUID
    customer_id: uuid.UUID
    reservation_start: datetime
    reservation_end: datetime
    party_size: int
    status: ReservationStatus
    notes: str | None
    created_at: datetime
    table_number: str | None = None
    restaurant_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ReservationStatusUpdate(BaseModel):
    status: ReservationStatus


# ---------- Orders ----------

class OrderItemCreate(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = Field(ge=1, default=1)


class OrderCreate(BaseModel):
    restaurant_id: uuid.UUID
    order_type: OrderType
    table_id: uuid.UUID | None = None
    booking_id: uuid.UUID | None = None
    delivery_address: str | None = None
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    quantity: int
    unit_price: float
    subtotal: float
    menu_item_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    order_type: OrderType
    restaurant_id: uuid.UUID
    customer_id: uuid.UUID | None
    table_id: uuid.UUID | None
    booking_id: uuid.UUID | None
    delivery_address: str | None
    assigned_waiter_id: uuid.UUID | None
    status: OrderStatus
    subtotal: float
    tax_amount: float
    service_charge_amount: float
    discount_amount: float
    total_amount: float
    created_at: datetime
    items: list[OrderItemResponse] = []
    table_number: str | None = None

    # Phase 19.2: read-only delivery enrichment (only populated for
    # DELIVERY-type orders; None for DINE_IN/ROOM_SERVICE).
    delivery_status: str | None = None
    delivery_driver_name: str | None = None
    delivery_assigned_at: datetime | None = None
    delivery_picked_up_at: datetime | None = None
    delivery_delivered_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderAssignWaiter(BaseModel):
    waiter_id: uuid.UUID


# ---------- Drivers ----------

class DriverListItem(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)