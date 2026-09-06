import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    String, Integer, Numeric, ForeignKey, DateTime, Date,
    Enum as SQLEnum, Text, Boolean, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class RoomStatus(str, enum.Enum):
    CLEANING = "CLEANING"
    MAINTENANCE = "MAINTENANCE"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"
    READY = "READY"


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    CANCELLED = "CANCELLED"


class HousekeepingStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class Hotel(Base):
    __tablename__ = "hotels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    room_types: Mapped[list["RoomType"]] = relationship(back_populates="hotel")
    rooms: Mapped[list["Room"]] = relationship(back_populates="hotel")


class RoomType(Base):
    __tablename__ = "room_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    max_occupancy: Mapped[int] = mapped_column(Integer, nullable=False, default=2)

    hotel: Mapped["Hotel"] = relationship(back_populates="room_types")
    rooms: Mapped[list["Room"]] = relationship(back_populates="room_type")


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("hotel_id", "room_number", name="uq_room_hotel_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id"), nullable=False)
    room_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("room_types.id"), nullable=False)
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[RoomStatus] = mapped_column(
        SQLEnum(RoomStatus, name="room_status_enum"), nullable=False, default=RoomStatus.READY
    )

    hotel: Mapped["Hotel"] = relationship(back_populates="rooms")
    room_type: Mapped["RoomType"] = relationship(back_populates="rooms")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="room")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_reference: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    guest_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False)
    number_of_guests: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[BookingStatus] = mapped_column(
        SQLEnum(BookingStatus, name="booking_status_enum"), nullable=False, default=BookingStatus.CONFIRMED
    )
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    special_requests: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    room: Mapped["Room"] = relationship(back_populates="bookings")


class HousekeepingTask(Base):
    __tablename__ = "housekeeping_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[HousekeepingStatus] = mapped_column(
        SQLEnum(HousekeepingStatus, name="housekeeping_status_enum"), nullable=False, default=HousekeepingStatus.PENDING
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)