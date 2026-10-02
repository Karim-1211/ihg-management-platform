import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    String, Numeric, ForeignKey, DateTime, Enum as SQLEnum,
    Boolean, CheckConstraint, Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class PromoScope(str, enum.Enum):
    """Where a code may be redeemed. ANY lets one code work across the whole
    platform; the others restrict it to a single part of the business."""
    ANY = "ANY"
    HOTEL = "HOTEL"
    RESTAURANT = "RESTAURANT"
    DELIVERY = "DELIVERY"


class PromoCode(Base):
    __tablename__ = "promo_codes"
    __table_args__ = (
        CheckConstraint("percent_off > 0 AND percent_off <= 1", name="ck_promo_percent_range"),
        CheckConstraint("times_redeemed >= 0", name="ck_promo_redeemed_nonnegative"),
        CheckConstraint("max_redemptions >= 1", name="ck_promo_max_redemptions_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)

    # Stored as a fraction (0.10 = 10%), matching the PERCENTAGE convention
    # the business-rule service already uses for tax and service charge.
    percent_off: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    scope: Mapped[PromoScope] = mapped_column(
        SQLEnum(PromoScope, name="promo_scope_enum"), nullable=False, default=PromoScope.ANY
    )

    # Issued to a subscriber: the code is tied to the email it was sent to,
    # so it cannot be passed around freely.
    issued_to_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    max_redemptions: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    times_redeemed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PromoRedemption(Base):
    """One row per successful use. Keeping redemptions separate from the code
    means a used code still shows who used it, on what, and for how much —
    the audit trail a discount on real money needs."""
    __tablename__ = "promo_redemptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promo_code_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("promo_codes.id"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    booking_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    order_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orders.id"), nullable=True)

    amount_discounted: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    redeemed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())