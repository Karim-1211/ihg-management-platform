import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.billing import InvoiceStatus, PaymentMethod, PaymentStatus


class RestaurantInvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    order_id: uuid.UUID
    restaurant_id: uuid.UUID
    customer_id: uuid.UUID | None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    status: InvoiceStatus
    issued_at: datetime
    order_number: str | None = None
    table_number: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RestaurantPaymentCreate(BaseModel):
    payment_method: PaymentMethod = PaymentMethod.DEMO


class RestaurantPaymentResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: float
    payment_method: PaymentMethod
    status: PaymentStatus
    transaction_reference: str | None
    paid_at: datetime

    model_config = ConfigDict(from_attributes=True)