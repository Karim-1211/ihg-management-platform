import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    String, Numeric, ForeignKey, DateTime, Enum as SQLEnum, CheckConstraint,
    UniqueConstraint, Text, Index, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class InvoiceType(str, enum.Enum):
    HOTEL = "HOTEL"
    RESTAURANT = "RESTAURANT"


class InvoiceStatus(str, enum.Enum):
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    MOBILE_PAYMENT = "MOBILE_PAYMENT"
    DEMO = "DEMO"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("invoice_number", name="invoices_invoice_number_key"),
        CheckConstraint(
            "(invoice_type = 'HOTEL' AND booking_id IS NOT NULL AND order_id IS NULL AND restaurant_id IS NULL) OR "
            "(invoice_type = 'RESTAURANT' AND order_id IS NOT NULL AND booking_id IS NULL AND restaurant_id IS NOT NULL)",
            name="ck_invoice_type_matches_reference",
        ),
        CheckConstraint("total_amount >= 0", name="ck_invoice_total_nonnegative"),
        CheckConstraint("amount_paid >= 0", name="ck_invoice_amount_paid_nonnegative"),
        CheckConstraint("amount_paid <= total_amount", name="ck_invoice_amount_paid_not_exceed_total"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number: Mapped[str] = mapped_column(String(20), nullable=False)
    invoice_type: Mapped[InvoiceType] = mapped_column(SQLEnum(InvoiceType, name="invoice_type_enum"), nullable=False)

    booking_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bookings.id"), unique=True, nullable=True)
    order_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orders.id"), unique=True, nullable=True)
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("restaurants.id"), nullable=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    room_charge: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    service_charge: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    status: Mapped[InvoiceStatus] = mapped_column(
        SQLEnum(InvoiceStatus, name="invoice_status_enum"), nullable=False, default=InvoiceStatus.UNPAID
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("payment_number", name="payments_payment_number_key"),
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        Index(
            "uq_payments_provider_reference", "provider", "provider_reference",
            unique=True, postgresql_where=text("provider_reference IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_number: Mapped[str] = mapped_column(String(20), nullable=False)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False)

    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod, name="payment_method_enum"), nullable=False, default=PaymentMethod.DEMO
    )
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus, name="payment_status_enum"), nullable=False, default=PaymentStatus.PENDING
    )
    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="DEMO")
    provider_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")