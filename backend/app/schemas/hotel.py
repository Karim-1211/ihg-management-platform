import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, EmailStr

from app.models.hotel import RoomStatus, BookingStatus, HousekeepingStatus
from app.models.service_request import ServiceRequestType, ServiceRequestStatus
from app.models.billing import PaymentMethod


# ---------- Hotel ----------

class HotelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None


class HotelResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    address: str | None
    city: str | None
    country: str | None
    phone: str | None
    email: str | None
    is_active: bool
    created_at: datetime
    primary_image_url: str | None = None  # Phase 30a.4 — resolved via media_service, never a raw DB column

    model_config = ConfigDict(from_attributes=True)


# ---------- Room Type ----------

class RoomTypeCreate(BaseModel):
    hotel_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    base_price: float = Field(gt=0)
    max_occupancy: int = Field(ge=1, default=2)


class RoomTypeResponse(BaseModel):
    id: uuid.UUID
    hotel_id: uuid.UUID
    name: str
    description: str | None
    base_price: float
    max_occupancy: int
    view_type: str | None = None
    bed_configuration: str | None = None
    has_balcony: bool = False
    has_bathtub: bool = False
    amenities: list[str] = []
    primary_image_url: str | None = None  # Phase 30a.4 — resolved via media_service

    model_config = ConfigDict(from_attributes=True)


# ---------- Room ----------

class RoomCreate(BaseModel):
    hotel_id: uuid.UUID
    room_type_id: uuid.UUID
    room_number: str = Field(min_length=1, max_length=20)
    floor: int | None = None


class RoomResponse(BaseModel):
    id: uuid.UUID
    hotel_id: uuid.UUID
    room_type_id: uuid.UUID
    room_number: str
    floor: int | None
    status: RoomStatus

    model_config = ConfigDict(from_attributes=True)


class RoomStatusUpdate(BaseModel):
    status: RoomStatus


# ---------- Booking ----------

class BookingCreate(BaseModel):
    room_id: uuid.UUID
    check_in_date: date
    check_out_date: date
    number_of_guests: int = Field(ge=1, default=1)
    special_requests: str | None = None


class BookingCheckoutCreate(BaseModel):
    room_id: uuid.UUID
    check_in_date: date
    check_out_date: date
    number_of_guests: int = Field(ge=1, default=1)
    guest_name: str = Field(min_length=2, max_length=200)
    guest_email: EmailStr
    guest_phone: str | None = Field(default=None, max_length=30)
    special_requests: str | None = Field(default=None, max_length=2000)
    payment_method: PaymentMethod
    promo_code: str | None = Field(default=None, max_length=32)


class BookingResponse(BaseModel):
    id: uuid.UUID
    booking_reference: str
    guest_id: uuid.UUID
    room_id: uuid.UUID
    check_in_date: date
    check_out_date: date
    number_of_guests: int
    # Snapshot taken at checkout — empty on bookings made before that flow
    # existed, which is why the account fields below are resolved too.
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    status: BookingStatus
    total_amount: float
    special_requests: str | None
    created_at: datetime
    # Resolved for display so the bookings list doesn't need a request per
    # booking to show who is staying and where.
    room_number: str | None = None
    room_type_name: str | None = None
    account_name: str | None = None
    account_email: str | None = None
    nights: int = 0
    # total_amount above is the ROOM CHARGE, before tax and discount. What a
    # guest wants to see is what they actually paid, which lives on the
    # invoice — resolved here so no page has to fetch invoices separately.
    invoice_total: float | None = None
    invoice_discount: float | None = None
    invoice_status: str | None = None

    model_config = ConfigDict(from_attributes=True)


class BookingCheckoutResponse(BaseModel):
    booking: BookingResponse
    invoice_id: uuid.UUID
    payment_id: uuid.UUID
    payment_method: PaymentMethod
    amount_paid: float
    total_amount: float
    discount_amount: float = 0
    promo_label: str | None = None


# ---------- Housekeeping ----------

class HousekeepingTaskResponse(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    assigned_to: uuid.UUID | None
    status: HousekeepingStatus
    notes: str | None
    created_at: datetime
    completed_at: datetime | None
    room_number: str | None = None

    model_config = ConfigDict(from_attributes=True)


class HousekeepingTaskUpdate(BaseModel):
    status: HousekeepingStatus
    notes: str | None = None


# ---------- Service Requests ----------

class ServiceRequestCreate(BaseModel):
    booking_id: uuid.UUID
    request_type: ServiceRequestType
    description: str | None = None


class ServiceRequestResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    requested_by: uuid.UUID
    assigned_to: uuid.UUID | None
    request_type: ServiceRequestType
    description: str | None
    price: float | None
    status: ServiceRequestStatus
    created_at: datetime
    completed_at: datetime | None
    room_number: str | None = None
    booking_reference: str | None = None
    guest_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ServiceRequestStatusUpdate(BaseModel):
    status: ServiceRequestStatus
    assigned_to: uuid.UUID | None = None
    price: float | None = Field(default=None, ge=0)