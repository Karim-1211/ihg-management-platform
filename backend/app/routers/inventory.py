import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.inventory import (
    InventoryItemCreate, InventoryItemResponse, ManualStockAdjustment, StockTransactionResponse,
    RecipeIngredientCreate, RecipeIngredientResponse,
)
from app.services import inventory_service

router = APIRouter(prefix="/api/v1/inventory", tags=["Inventory"])

# Any role that can see an inventory item can also see how its stock moved —
# a waiter or kitchen user reading "12.9 kg left" needs to know whether that
# came from an order, waste or a delivery. The per-item ownership check in
# inventory_service still applies on top of this.
STOCK_VIEW_ROLES = (
    RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST,
    RoleEnum.HOUSEKEEPING, RoleEnum.KITCHEN, RoleEnum.WAITER,
)

# Kitchen and waiting staff are the people who actually discover waste and
# breakage, so they can record it; the service layer still refuses
# ORDER_USAGE from this path, which only an order may create.
STOCK_EDIT_ROLES = (
    RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST,
    RoleEnum.HOUSEKEEPING, RoleEnum.KITCHEN, RoleEnum.WAITER,
)


@router.post("/items", response_model=InventoryItemResponse, status_code=201)
def create_item(
    data: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return inventory_service.create_inventory_item(db, current_user, data)


@router.get("/hotel/{hotel_id}", response_model=list[InventoryItemResponse])
def list_for_hotel(
    hotel_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*STOCK_VIEW_ROLES)),
):
    return inventory_service.list_inventory_for_hotel(db, current_user, hotel_id)


@router.get("/restaurant/{restaurant_id}", response_model=list[InventoryItemResponse])
def list_for_restaurant(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*STOCK_VIEW_ROLES)),
):
    return inventory_service.list_inventory_for_restaurant(db, current_user, restaurant_id)


@router.post("/items/{item_id}/transactions", response_model=StockTransactionResponse, status_code=201)
def record_transaction(
    item_id: uuid.UUID,
    data: ManualStockAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*STOCK_EDIT_ROLES)),
):
    return inventory_service.record_manual_transaction(db, current_user, item_id, data)


@router.get("/items/{item_id}/transactions", response_model=list[StockTransactionResponse])
def list_transactions(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*STOCK_VIEW_ROLES)),
):
    return inventory_service.list_transactions_for_item(db, current_user, item_id)


@router.post("/recipes", response_model=RecipeIngredientResponse, status_code=201)
def create_recipe_ingredient(
    data: RecipeIngredientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return inventory_service.create_recipe_ingredient(db, current_user, data)


@router.get("/recipes/menu-item/{menu_item_id}", response_model=list[RecipeIngredientResponse])
def get_recipe(menu_item_id: uuid.UUID, db: Session = Depends(get_db)):
    return inventory_service.list_recipe_for_menu_item(db, menu_item_id)