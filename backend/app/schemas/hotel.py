import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.hotel import RoomStatus, BookingStatus, HousekeepingStatus
from app.models.service_request import ServiceRequestType, ServiceRequestStatus


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


class BookingResponse(BaseModel):
    id: uuid.UUID
    booking_reference: str
    guest_id: uuid.UUID
    room_id: uuid.UUID
    check_in_date: date
    check_out_date: date
    number_of_guests: int
    status: BookingStatus
    total_amount: float
    special_requests: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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