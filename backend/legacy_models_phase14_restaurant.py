"""Temporary read-only models mapping to the renamed legacy Restaurant/Delivery
billing tables. Used only by backfill_phase14_restaurant.py. Not imported by
the live application."""

import uuid
from datetime import datetime

from sqlalchemy import String, Numeric, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.billing import InvoiceStatus, PaymentMethod, PaymentStatus


class RestaurantInvoiceLegacy(Base):
    __tablename__ = "restaurant_invoices_legacy"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(20))
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"))
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2))
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[InvoiceStatus] = mapped_column(SQLEnum(InvoiceStatus, name="invoice_status_enum"))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RestaurantPaymentLegacy(Base):
    __tablename__ = "restaurant_payments_legacy"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurant_invoices_legacy.id"))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    payment_method: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod, name="payment_method_enum"))
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus, name="payment_status_enum"))
    transaction_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))