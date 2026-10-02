import uuid

from pydantic import BaseModel, Field

from app.models.promo import PromoScope


class PromoPreviewRequest(BaseModel):
    code: str = Field(min_length=3, max_length=32)
    scope: PromoScope
    subtotal: float = Field(gt=0)


class PromoPreviewResponse(BaseModel):
    code: str
    percent_off: float
    discount_amount: float
    label: str
    promo_id: uuid.UUID