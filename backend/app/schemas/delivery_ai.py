from pydantic import BaseModel, Field


class DeliveryAIRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class DeliveryAIResponse(BaseModel):
    message: str
    action: str | None = None
    restaurant_id: str | None = None
    menu_item_ids: list[str] = []
    order_id: str | None = None