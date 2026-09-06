import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class RoleEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    MANAGER = "MANAGER"
    RECEPTIONIST = "RECEPTIONIST"
    HOUSEKEEPING = "HOUSEKEEPING"
    WAITER = "WAITER"
    KITCHEN = "KITCHEN"
    DELIVERY = "DELIVERY"
    CUSTOMER = "CUSTOMER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(
        SQLEnum(RoleEnum, name="role_enum"), nullable=False, default=RoleEnum.CUSTOMER
    )
    hotel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("hotels.id"), nullable=True
    )
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("restaurants.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )