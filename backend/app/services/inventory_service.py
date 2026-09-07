import uuid
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.inventory import InventoryItem, StockTransaction, TransactionType, RecipeIngredient
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant
from app.schemas.inventory import InventoryItemCreate, ManualStockAdjustment, RecipeIngredientCreate
from app.schemas.notification_event import NotificationEvent
from app.models.notification import NotificationType
from app.services.restaurant_service import assert_restaurant_access
from app.services import notification_service


def _assert_inventory_access(db: Session, current_user: User, item: InventoryItem) -> None:
    if current_user.role == RoleEnum.SUPER_ADMIN:
        return
    if item.hotel_id is not None:
        if current_user.role == RoleEnum.MANAGER and current_user.hotel_id == item.hotel_id:
            return
        if current_user.role in (RoleEnum.RECEPTIONIST, RoleEnum.HOUSEKEEPING) and current_user.hotel_id == item.hotel_id:
            return
        if current_user.role == RoleEnum.KITCHEN and current_user.restaurant_id:
            restaurant = db.query(Restaurant).filter(Restaurant.id == current_user.restaurant_id).first()
            if restaurant and restaurant.hotel_id == item.hotel_id:
                return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this inventory item.")
    if item.restaurant_id is not None:
        assert_restaurant_access(db, current_user, item.restaurant_id)
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this inventory item.")


def _attach_low_stock_flag(item: InventoryItem) -> InventoryItem:
    item.is_low_stock = float(item.current_quantity) <= float(item.minimum_quantity)
    return item


def _maybe_dispatch_low_stock(db: Session, item: InventoryItem, quantity_before: Decimal, quantity_after: Decimal, transaction_id: uuid.UUID) -> None:
    """Fires LOW_STOCK_ALERT only on the transition INTO low stock (was above
    minimum, now at or below it) — not on every transaction while already low.
    Uses the triggering transaction's own id as entity_id so repeated
    depletions of the same item each get their own notification, per the
    locked idempotency design (event_id derives from entity_id)."""
    minimum = Decimal(str(item.minimum_quantity))
    was_above_minimum = quantity_before > minimum
    now_at_or_below_minimum = quantity_after <= minimum
    if was_above_minimum and now_at_or_below_minimum:
        notification_service.dispatch(db, NotificationEvent(
            event_type=NotificationType.LOW_STOCK_ALERT,
            entity_type="stock_transaction",
            entity_id=transaction_id,
            hotel_id=item.hotel_id,
            restaurant_id=item.restaurant_id,
            metadata={
                "item_name": item.name,
                "current_quantity": str(quantity_after),
                "minimum_quantity": str(minimum),
                "unit": item.unit,
            },
        ))


def create_inventory_item(db: Session, current_user: User, data: InventoryItemCreate) -> InventoryItem:
    if current_user.role not in (RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only managers can create inventory items.")
    if data.hotel_id and current_user.role == RoleEnum.MANAGER and current_user.hotel_id != data.hotel_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not manage this hotel.")
    if data.restaurant_id:
        assert_restaurant_access(db, current_user, data.restaurant_id)
    item = InventoryItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _attach_low_stock_flag(item)


def get_item_or_404(db: Session, item_id: uuid.UUID) -> InventoryItem:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found.")
    return item


def list_inventory_for_hotel(db: Session, current_user: User, hotel_id: uuid.UUID) -> list[InventoryItem]:
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.hotel_id == hotel_id, InventoryItem.is_active == True)  # noqa: E712
        .all()
    )
    if items:
        _assert_inventory_access(db, current_user, items[0])
    return [_attach_low_stock_flag(i) for i in items]


def list_inventory_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[InventoryItem]:
    assert_restaurant_access(db, current_user, restaurant_id)
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant_id, InventoryItem.is_active == True)  # noqa: E712
        .all()
    )
    return [_attach_low_stock_flag(i) for i in items]


def record_manual_transaction(
    db: Session, current_user: User, item_id: uuid.UUID, data: ManualStockAdjustment
) -> StockTransaction:
    item = get_item_or_404(db, item_id)
    _assert_inventory_access(db, current_user, item)
    quantity_before = Decimal(str(item.current_quantity))
    if data.transaction_type in (TransactionType.PURCHASE, TransactionType.RETURN):
        quantity_after = quantity_before + Decimal(str(data.quantity))
    elif data.transaction_type in (TransactionType.WASTE, TransactionType.SERVICE_USAGE, TransactionType.MANUAL_ADJUSTMENT):
        quantity_after = quantity_before - Decimal(str(data.quantity))
        if quantity_after < 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot remove {data.quantity} {item.unit}; only {quantity_before} {item.unit} available.",
            )
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="ORDER_USAGE cannot be recorded manually.")
    item.current_quantity = quantity_after
    transaction = StockTransaction(
        inventory_item_id=item.id,
        transaction_type=data.transaction_type,
        quantity=data.quantity,
        quantity_before=quantity_before,
        quantity_after=quantity_after,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    _maybe_dispatch_low_stock(db, item, quantity_before, quantity_after, transaction.id)
    return transaction


def _attach_transaction_display_fields(db: Session, txn: StockTransaction) -> StockTransaction:
    item = db.query(InventoryItem).filter(InventoryItem.id == txn.inventory_item_id).first()
    if item:
        txn.inventory_item_name = item.name
    if txn.created_by:
        user = db.query(User).filter(User.id == txn.created_by).first()
        if user:
            txn.created_by_name = f"{user.first_name} {user.last_name}"
    return txn


def list_transactions_for_item(db: Session, current_user: User, item_id: uuid.UUID) -> list[StockTransaction]:
    item = get_item_or_404(db, item_id)
    _assert_inventory_access(db, current_user, item)
    txns = (
        db.query(StockTransaction)
        .filter(StockTransaction.inventory_item_id == item_id)
        .order_by(StockTransaction.created_at.desc())
        .all()
    )
    return [_attach_transaction_display_fields(db, t) for t in txns]


def _attach_recipe_display_fields(db: Session, recipe: RecipeIngredient) -> RecipeIngredient:
    item = db.query(InventoryItem).filter(InventoryItem.id == recipe.inventory_item_id).first()
    if item:
        recipe.inventory_item_name = item.name
        recipe.inventory_item_unit = item.unit
    return recipe


def create_recipe_ingredient(db: Session, current_user: User, data: RecipeIngredientCreate) -> RecipeIngredient:
    from app.models.restaurant import MenuItem, MenuCategory
    menu_item = db.query(MenuItem).filter(MenuItem.id == data.menu_item_id).first()
    if not menu_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")
    category = db.query(MenuCategory).filter(MenuCategory.id == menu_item.category_id).first()
    assert_restaurant_access(db, current_user, category.restaurant_id)
    inventory_item = get_item_or_404(db, data.inventory_item_id)
    _assert_inventory_access(db, current_user, inventory_item)
    existing = (
        db.query(RecipeIngredient)
        .filter(RecipeIngredient.menu_item_id == data.menu_item_id, RecipeIngredient.inventory_item_id == data.inventory_item_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This ingredient is already linked to this menu item.")
    recipe = RecipeIngredient(**data.model_dump())
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return _attach_recipe_display_fields(db, recipe)


def list_recipe_for_menu_item(db: Session, menu_item_id: uuid.UUID) -> list[RecipeIngredient]:
    recipes = db.query(RecipeIngredient).filter(RecipeIngredient.menu_item_id == menu_item_id).all()
    return [_attach_recipe_display_fields(db, r) for r in recipes]


def deduct_stock_for_order(db: Session, order, order_items: list) -> None:
    """Called when an order transitions NEW -> CONFIRMED. Atomic: validates every
    required ingredient has sufficient stock BEFORE deducting anything. If any
    ingredient is insufficient, raises and changes nothing."""
    required: dict[uuid.UUID, Decimal] = {}
    for oi in order_items:
        recipe_lines = db.query(RecipeIngredient).filter(RecipeIngredient.menu_item_id == oi.menu_item_id).all()
        for line in recipe_lines:
            needed = Decimal(str(line.quantity_required)) * Decimal(str(oi.quantity))
            required[line.inventory_item_id] = required.get(line.inventory_item_id, Decimal("0")) + needed
    if not required:
        return
    items_by_id: dict[uuid.UUID, InventoryItem] = {}
    for inv_id, needed_qty in required.items():
        item = db.query(InventoryItem).filter(InventoryItem.id == inv_id).first()
        if not item:
            continue
        items_by_id[inv_id] = item
        available = Decimal(str(item.current_quantity))
        if available < needed_qty:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for '{item.name}': need {needed_qty} {item.unit}, have {available} {item.unit}.",
            )
    low_stock_candidates: list[tuple[InventoryItem, Decimal, Decimal, uuid.UUID]] = []
    for inv_id, needed_qty in required.items():
        item = items_by_id.get(inv_id)
        if not item:
            continue
        quantity_before = Decimal(str(item.current_quantity))
        quantity_after = quantity_before - needed_qty
        item.current_quantity = quantity_after
        txn = StockTransaction(
            inventory_item_id=item.id,
            transaction_type=TransactionType.ORDER_USAGE,
            quantity=needed_qty,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            reference_type="order",
            reference_id=order.id,
            notes=f"Auto-deducted for order {order.order_number}",
        )
        db.add(txn)
        db.flush()  # so txn.id is available below without a second commit
        low_stock_candidates.append((item, quantity_before, quantity_after, txn.id))

    db.commit()

    for item, quantity_before, quantity_after, txn_id in low_stock_candidates:
        _maybe_dispatch_low_stock(db, item, quantity_before, quantity_after, txn_id)