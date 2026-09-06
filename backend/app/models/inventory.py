import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    String, Integer, Numeric, ForeignKey, DateTime, Enum as SQLEnum,
    Text, Boolean, CheckConstraint, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TransactionType(str, enum.Enum):
    PURCHASE = "PURCHASE"
    ORDER_USAGE = "ORDER_USAGE"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    WASTE = "WASTE"
    RETURN = "RETURN"
    SERVICE_USAGE = "SERVICE_USAGE"


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        CheckConstraint(
            "(hotel_id IS NOT NULL AND restaurant_id IS NULL) OR "
            "(hotel_id IS NULL AND restaurant_id IS NOT NULL)",
            name="ck_inventory_item_single_owner",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hotels.id"), nullable=True)
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("restaurants.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    current_quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    minimum_quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="inventory_item")


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    transaction_type: Mapped[TransactionType] = mapped_column(
        SQLEnum(TransactionType, name="transaction_type_enum"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    quantity_before: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    quantity_after: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="transactions")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    __table_args__ = (
        UniqueConstraint("menu_item_id", "inventory_item_id", name="uq_recipe_menu_item_ingredient"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    menu_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_items.id"), nullable=False)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    quantity_required: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())