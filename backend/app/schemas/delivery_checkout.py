import uuid

from pydantic import BaseModel, Field, field_validator

from app.models.billing import PaymentMethod

# The only methods offered at delivery checkout — the same three the hotel
# checkout offers, all processed in demo mode.
CHECKOUT_PAYMENT_METHODS = {PaymentMethod.VISA, PaymentMethod.MASTERCARD, PaymentMethod.PAYPAL}


class DeliveryLine(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = Field(ge=1, le=50)


class DeliveryQuoteRequest(BaseModel):
    restaurant_id: uuid.UUID
    items: list[DeliveryLine] = Field(min_length=1, max_length=60)


class DeliveryQuoteLine(BaseModel):
    menu_item_id: uuid.UUID
    name: str
    quantity: int
    unit_price: float
    subtotal: float


class DeliveryQuoteResponse(BaseModel):
    restaurant_id: uuid.UUID
    lines: list[DeliveryQuoteLine]
    unavailable_item_ids: list[uuid.UUID] = []
    subtotal: float
    tax_amount: float
    service_charge_amount: float
    discount_amount: float
    total_amount: float
    # Configured by a manager, never guessed — see DELIVERY_PREPARATION_MINUTES
    # and DELIVERY_TRAVEL_MINUTES.
    estimated_minutes_min: int = 0
    estimated_minutes_max: int = 0


class DeliveryCheckoutRequest(DeliveryQuoteRequest):
    delivery_address: str = Field(min_length=5, max_length=500)
    contact_phone: str = Field(min_length=6, max_length=30)
    delivery_notes: str | None = Field(default=None, max_length=500)
    payment_method: PaymentMethod
    promo_code: str | None = Field(default=None, max_length=32)

    @field_validator("delivery_address", "contact_phone")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value

    @field_validator("payment_method")
    @classmethod
    def supported_method(cls, value: PaymentMethod) -> PaymentMethod:
        if value not in CHECKOUT_PAYMENT_METHODS:
            raise ValueError("Please choose Visa, Mastercard or PayPal.")
        return value


class DeliveryCheckoutResponse(BaseModel):
    order_id: uuid.UUID
    order_number: str
    total_amount: float
    invoice_number: str
    payment_number: str
    payment_status: str
    payment_method: str
    discount_amount: float = 0
    promo_label: str | None = None