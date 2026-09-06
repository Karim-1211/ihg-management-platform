"""Temporary read-only models mapping to the renamed legacy Hotel billing
tables. Used only by backfill_phase14.py. Not imported by the live application."""

import uuid
from datetime import datetime

from sqlalchemy import String, Numeric, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.billing import InvoiceStatus, PaymentMethod, PaymentStatus


class InvoiceLegacy(Base):
    __tablename__ = "invoices_legacy"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(20))
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"))
    guest_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    room_charge: Mapped[float] = mapped_column(Numeric(10, 2))
    service_charge: Mapped[float] = mapped_column(Numeric(10, 2))
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2))
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[InvoiceStatus] = mapped_column(SQLEnum(InvoiceStatus, name="invoice_status_enum"))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PaymentLegacy(Base):
    __tablename__ = "payments_legacy"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices_legacy.id"))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    payment_method: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod, name="payment_method_enum"))
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus, name="payment_status_enum"))
    transaction_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))