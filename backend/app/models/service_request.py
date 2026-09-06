import enum
import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, Enum as SQLEnum, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class ServiceRequestType(str, enum.Enum):
    ROOM_CLEANING = "ROOM_CLEANING"
    EXTRA_TOWELS = "EXTRA_TOWELS"
    WATER = "WATER"
    FOOD = "FOOD"
    AMENITIES = "AMENITIES"
    OTHER = "OTHER"


class ServiceRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    request_type: Mapped[ServiceRequestType] = mapped_column(
        SQLEnum(ServiceRequestType, name="service_request_type_enum"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[ServiceRequestStatus] = mapped_column(
        SQLEnum(ServiceRequestStatus, name="service_request_status_enum"),
        nullable=False, default=ServiceRequestStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)