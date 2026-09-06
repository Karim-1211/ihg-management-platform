import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.inventory import TransactionType


class InventoryItemCreate(BaseModel):
    hotel_id: uuid.UUID | None = None
    restaurant_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    unit: str = Field(min_length=1, max_length=20)
    current_quantity: float = Field(ge=0, default=0)
    minimum_quantity: float = Field(ge=0, default=0)

    @model_validator(mode="after")
    def exactly_one_owner(self):
        if bool(self.hotel_id) == bool(self.restaurant_id):
            raise ValueError("Exactly one of hotel_id or restaurant_id must be set (not both, not neither).")
        return self


class InventoryItemResponse(BaseModel):
    id: uuid.UUID
    hotel_id: uuid.UUID | None
    restaurant_id: uuid.UUID | None
    name: str
    description: str | None
    unit: str
    current_quantity: float
    minimum_quantity: float
    is_active: bool
    is_low_stock: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ManualStockAdjustment(BaseModel):
    transaction_type: TransactionType
    quantity: float = Field(gt=0)
    notes: str | None = None


class StockTransactionResponse(BaseModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    transaction_type: TransactionType
    quantity: float
    quantity_before: float
    quantity_after: float
    reference_type: str | None
    reference_id: uuid.UUID | None
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    inventory_item_name: str | None = None
    created_by_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RecipeIngredientCreate(BaseModel):
    menu_item_id: uuid.UUID
    inventory_item_id: uuid.UUID
    quantity_required: float = Field(gt=0)


class RecipeIngredientResponse(BaseModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    inventory_item_id: uuid.UUID
    quantity_required: float
    inventory_item_name: str | None = None
    inventory_item_unit: str | None = None

    model_config = ConfigDict(from_attributes=True)