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
    current_user: User = Depends(require_roles(
        RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST, RoleEnum.HOUSEKEEPING, RoleEnum.KITCHEN
    )),
):
    return inventory_service.list_inventory_for_hotel(db, current_user, hotel_id)


@router.get("/restaurant/{restaurant_id}", response_model=list[InventoryItemResponse])
def list_for_restaurant(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.KITCHEN, RoleEnum.WAITER
    )),
):
    return inventory_service.list_inventory_for_restaurant(db, current_user, restaurant_id)


@router.post("/items/{item_id}/transactions", response_model=StockTransactionResponse, status_code=201)
def record_transaction(
    item_id: uuid.UUID,
    data: ManualStockAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST, RoleEnum.HOUSEKEEPING
    )),
):
    return inventory_service.record_manual_transaction(db, current_user, item_id, data)


@router.get("/items/{item_id}/transactions", response_model=list[StockTransactionResponse])
def list_transactions(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST, RoleEnum.HOUSEKEEPING, RoleEnum.KITCHEN
    )),
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