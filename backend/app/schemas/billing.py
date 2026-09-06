import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.billing import InvoiceType, InvoiceStatus, PaymentMethod, PaymentStatus


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    invoice_type: InvoiceType
    booking_id: uuid.UUID | None
    order_id: uuid.UUID | None
    restaurant_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    room_charge: float | None
    service_charge: float | None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    amount_paid: float
    status: InvoiceStatus
    issued_at: datetime
    booking_reference: str | None = None
    room_number: str | None = None
    remaining_balance: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class PaymentCreate(BaseModel):
    payment_method: PaymentMethod = PaymentMethod.DEMO
    amount: float | None = Field(default=None, gt=0)  # None = pay full remaining balance


class PaymentResponse(BaseModel):
    id: uuid.UUID
    payment_number: str
    invoice_id: uuid.UUID
    amount: float
    method: PaymentMethod
    status: PaymentStatus
    provider: str
    provider_reference: str | None
    paid_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)