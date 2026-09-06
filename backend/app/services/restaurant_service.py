import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.restaurant import Restaurant, RestaurantTable, MenuCategory, MenuItem, TableStatus
from app.models.user import User, RoleEnum
from app.schemas.restaurant import (
    RestaurantCreate, RestaurantTableCreate, MenuCategoryCreate, MenuItemCreate, MenuItemUpdate,
)
from app.services import audit_service


def get_restaurant_or_404(db: Session, restaurant_id: uuid.UUID) -> Restaurant:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")
    return restaurant


def assert_restaurant_access(db: Session, current_user: User, restaurant_id: uuid.UUID) -> Restaurant:
    """Central tenant-boundary check. Every restaurant-scoped write/read of operational
    data (tables, menu, orders, deliveries) for staff roles must pass through this."""
    restaurant = get_restaurant_or_404(db, restaurant_id)

    if current_user.role == RoleEnum.SUPER_ADMIN:
        return restaurant

    if current_user.role == RoleEnum.MANAGER:
        if restaurant.hotel_id is None or restaurant.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not manage this restaurant.",
            )
        return restaurant

    if current_user.role in (RoleEnum.WAITER, RoleEnum.KITCHEN, RoleEnum.DELIVERY):
        if current_user.restaurant_id != restaurant.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this restaurant.",
            )
        return restaurant

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this restaurant.")


def create_restaurant(db: Session, data: RestaurantCreate) -> Restaurant:
    restaurant = Restaurant(**data.model_dump())
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


def list_restaurants(db: Session) -> list[Restaurant]:
    return db.query(Restaurant).filter(Restaurant.is_active == True).all()  # noqa: E712


def create_table(db: Session, current_user: User, data: RestaurantTableCreate) -> RestaurantTable:
    assert_restaurant_access(db, current_user, data.restaurant_id)

    existing = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.restaurant_id == data.restaurant_id, RestaurantTable.table_number == data.table_number)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A table with this number already exists at this restaurant.",
        )

    table = RestaurantTable(**data.model_dump())
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


def list_tables(db: Session, restaurant_id: uuid.UUID) -> list[RestaurantTable]:
    return db.query(RestaurantTable).filter(RestaurantTable.restaurant_id == restaurant_id).all()


def get_table_or_404(db: Session, table_id: uuid.UUID) -> RestaurantTable:
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found.")
    return table


def update_table_status(db: Session, current_user: User, table_id: uuid.UUID, new_status: TableStatus) -> RestaurantTable:
    table = get_table_or_404(db, table_id)
    assert_restaurant_access(db, current_user, table.restaurant_id)
    table.status = new_status
    db.commit()
    db.refresh(table)
    return table


def create_menu_category(db: Session, current_user: User, data: MenuCategoryCreate) -> MenuCategory:
    assert_restaurant_access(db, current_user, data.restaurant_id)
    category = MenuCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def list_menu_categories(db: Session, restaurant_id: uuid.UUID) -> list[MenuCategory]:
    return (
        db.query(MenuCategory)
        .filter(MenuCategory.restaurant_id == restaurant_id)
        .order_by(MenuCategory.display_order)
        .all()
    )


def create_menu_item(db: Session, current_user: User, data: MenuItemCreate) -> MenuItem:
    category = db.query(MenuCategory).filter(MenuCategory.id == data.category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu category not found.")
    assert_restaurant_access(db, current_user, category.restaurant_id)

    item = MenuItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_menu_items(db: Session, category_id: uuid.UUID) -> list[MenuItem]:
    return db.query(MenuItem).filter(MenuItem.category_id == category_id).all()


def get_full_menu(db: Session, restaurant_id: uuid.UUID) -> list[MenuCategory]:
    categories = list_menu_categories(db, restaurant_id)
    for cat in categories:
        cat.items = list_menu_items(db, cat.id)
    return categories


def update_menu_item(db: Session, current_user: User, item_id: uuid.UUID, data: MenuItemUpdate) -> MenuItem:
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    category = db.query(MenuCategory).filter(MenuCategory.id == item.category_id).first()
    assert_restaurant_access(db, current_user, category.restaurant_id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    audit_service.log_action(
        db, current_user.id, "UPDATE_MENU_ITEM", "menu_item", item.id,
        f"Updated menu item '{item.name}'",
    )
    return item


def list_drivers_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[User]:
    assert_restaurant_access(db, current_user, restaurant_id)
    return (
        db.query(User)
        .filter(User.restaurant_id == restaurant_id, User.role == RoleEnum.DELIVERY, User.is_active == True)  # noqa: E712
        .all()
    )