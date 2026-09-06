import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum
from app.schemas.restaurant import (
    RestaurantCreate, RestaurantResponse, RestaurantTableCreate, RestaurantTableResponse, TableStatusUpdate,
    MenuCategoryCreate, MenuCategoryResponse, MenuItemCreate, MenuItemResponse, MenuItemUpdate,
    MenuWithItemsResponse, DriverListItem,
)
from app.services import restaurant_service

router = APIRouter(prefix="/api/v1", tags=["Restaurants"])


@router.post("/restaurants", response_model=RestaurantResponse, status_code=201)
def create_restaurant(
    data: RestaurantCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    return restaurant_service.create_restaurant(db, data)


@router.get("/restaurants", response_model=list[RestaurantResponse])
def list_restaurants(db: Session = Depends(get_db)):
    return restaurant_service.list_restaurants(db)


@router.post("/restaurant-tables", response_model=RestaurantTableResponse, status_code=201)
def create_table(
    data: RestaurantTableCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return restaurant_service.create_table(db, current_user, data)


@router.get("/restaurants/{restaurant_id}/tables", response_model=list[RestaurantTableResponse])
def list_tables(restaurant_id: uuid.UUID, db: Session = Depends(get_db)):
    return restaurant_service.list_tables(db, restaurant_id)


@router.get("/restaurants/{restaurant_id}/drivers", response_model=list[DriverListItem])
def list_drivers(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return restaurant_service.list_drivers_for_restaurant(db, current_user, restaurant_id)


@router.patch("/restaurant-tables/{table_id}/status", response_model=RestaurantTableResponse)
def update_table_status(
    table_id: uuid.UUID,
    data: TableStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return restaurant_service.update_table_status(db, current_user, table_id, data.status)


@router.post("/menu-categories", response_model=MenuCategoryResponse, status_code=201)
def create_menu_category(
    data: MenuCategoryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return restaurant_service.create_menu_category(db, current_user, data)


@router.post("/menu-items", response_model=MenuItemResponse, status_code=201)
def create_menu_item(
    data: MenuItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return restaurant_service.create_menu_item(db, current_user, data)


@router.get("/restaurants/{restaurant_id}/menu", response_model=list[MenuWithItemsResponse])
def get_full_menu(restaurant_id: uuid.UUID, db: Session = Depends(get_db)):
    return restaurant_service.get_full_menu(db, restaurant_id)


@router.patch("/menu-items/{item_id}", response_model=MenuItemResponse)
def update_menu_item(
    item_id: uuid.UUID,
    data: MenuItemUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return restaurant_service.update_menu_item(db, current_user, item_id, data)