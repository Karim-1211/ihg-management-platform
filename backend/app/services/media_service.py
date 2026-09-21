"""Phase 30a.2 — media service layer. Polymorphic CRUD over MediaAsset,
with entity-existence validation and tenant/role authorization enforced
here at the service layer (never a database FK, per the locked 30a.1
design). Reuses hotel_service.assert_hotel_access and
restaurant_service.assert_restaurant_access rather than inventing a
second authorization mechanism."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.hotel import Hotel, RoomType
from app.models.restaurant import Restaurant, MenuItem, MenuCategory
from app.models.media import MediaAsset, MediaEntityType
from app.models.user import User, RoleEnum
from app.schemas.media import MediaCreate, MediaUpdate
from app.services import hotel_service, restaurant_service


def _resolve_entity_scope(db: Session, entity_type: MediaEntityType, entity_id: uuid.UUID) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """Validates the entity actually exists, and returns (hotel_id,
    restaurant_id) — whichever tenant this media belongs to. This is
    stored on the MediaAsset row itself for fast scoped queries, and used
    directly for authorization."""
    if entity_type == MediaEntityType.HOTEL:
        hotel = db.query(Hotel).filter(Hotel.id == entity_id).first()
        if not hotel:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found.")
        return hotel.id, None

    if entity_type == MediaEntityType.ROOM:
        from app.models.hotel import Room
        room = db.query(Room).filter(Room.id == entity_id).first()
        if not room:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")
        return room.hotel_id, None

    if entity_type == MediaEntityType.ROOM_TYPE:
        room_type = db.query(RoomType).filter(RoomType.id == entity_id).first()
        if not room_type:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room type not found.")
        return room_type.hotel_id, None

    if entity_type == MediaEntityType.RESTAURANT:
        restaurant = db.query(Restaurant).filter(Restaurant.id == entity_id).first()
        if not restaurant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")
        return None, restaurant.id

    if entity_type == MediaEntityType.MENU_ITEM:
        menu_item = db.query(MenuItem).filter(MenuItem.id == entity_id).first()
        if not menu_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")
        category = db.query(MenuCategory).filter(MenuCategory.id == menu_item.category_id).first()
        return None, category.restaurant_id if category else None

    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown entity_type.")


def _assert_media_write_access(db: Session, current_user: User, hotel_id: uuid.UUID | None, restaurant_id: uuid.UUID | None) -> None:
    if current_user.role == RoleEnum.SUPER_ADMIN:
        return
    if current_user.role != RoleEnum.MANAGER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to manage media.")
    if hotel_id is not None:
        hotel_service.assert_hotel_access(db, current_user, hotel_id)
    if restaurant_id is not None:
        restaurant_service.assert_restaurant_access(db, current_user, restaurant_id)


def create_media(db: Session, current_user: User, data: MediaCreate) -> MediaAsset:
    hotel_id, restaurant_id = _resolve_entity_scope(db, data.entity_type, data.entity_id)
    _assert_media_write_access(db, current_user, hotel_id, restaurant_id)

    if data.is_primary:
        db.query(MediaAsset).filter(
            MediaAsset.entity_type == data.entity_type,
            MediaAsset.entity_id == data.entity_id,
            MediaAsset.is_primary == True,  # noqa: E712
        ).update({"is_primary": False})

    asset = MediaAsset(
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        source_type=data.source_type,
        url=data.url,
        caption=data.caption,
        alt_text=data.alt_text,
        sort_order=data.sort_order,
        is_primary=data.is_primary,
        is_active=True,
        hotel_id=hotel_id,
        restaurant_id=restaurant_id,
        created_by=current_user.id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def get_media_or_404(db: Session, media_id: uuid.UUID) -> MediaAsset:
    asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found.")
    return asset


def update_media(db: Session, current_user: User, media_id: uuid.UUID, data: MediaUpdate) -> MediaAsset:
    asset = get_media_or_404(db, media_id)
    _assert_media_write_access(db, current_user, asset.hotel_id, asset.restaurant_id)

    if data.caption is not None:
        asset.caption = data.caption
    if data.alt_text is not None:
        asset.alt_text = data.alt_text
    if data.sort_order is not None:
        asset.sort_order = data.sort_order

    db.commit()
    db.refresh(asset)
    return asset


def set_primary(db: Session, current_user: User, media_id: uuid.UUID) -> MediaAsset:
    asset = get_media_or_404(db, media_id)
    _assert_media_write_access(db, current_user, asset.hotel_id, asset.restaurant_id)

    db.query(MediaAsset).filter(
        MediaAsset.entity_type == asset.entity_type,
        MediaAsset.entity_id == asset.entity_id,
        MediaAsset.is_primary == True,  # noqa: E712
    ).update({"is_primary": False})

    asset.is_primary = True
    db.commit()
    db.refresh(asset)
    return asset


def set_active_status(db: Session, current_user: User, media_id: uuid.UUID, is_active: bool) -> MediaAsset:
    asset = get_media_or_404(db, media_id)
    _assert_media_write_access(db, current_user, asset.hotel_id, asset.restaurant_id)
    asset.is_active = is_active
    if not is_active and asset.is_primary:
        asset.is_primary = False  # a deactivated image cannot remain the primary
    db.commit()
    db.refresh(asset)
    return asset


def reorder_media(db: Session, current_user: User, entity_type: MediaEntityType, entity_id: uuid.UUID, ordered_ids: list[uuid.UUID]) -> list[MediaAsset]:
    hotel_id, restaurant_id = _resolve_entity_scope(db, entity_type, entity_id)
    _assert_media_write_access(db, current_user, hotel_id, restaurant_id)

    assets = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type, MediaAsset.entity_id == entity_id
    ).all()
    asset_map = {a.id: a for a in assets}

    for position, asset_id in enumerate(ordered_ids):
        if asset_id in asset_map:
            asset_map[asset_id].sort_order = position

    db.commit()
    return db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type, MediaAsset.entity_id == entity_id
    ).order_by(MediaAsset.sort_order).all()


def list_media(db: Session, entity_type: MediaEntityType, entity_id: uuid.UUID, include_inactive: bool = False) -> list[MediaAsset]:
    """Read access — available to any authenticated user, matching the
    existing project pattern where browsing hotels/restaurants/menus
    requires login but no specific role."""
    query = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type, MediaAsset.entity_id == entity_id
    )
    if not include_inactive:
        query = query.filter(MediaAsset.is_active == True)  # noqa: E712
    return query.order_by(MediaAsset.sort_order).all()


def resolve_primary_image_url(db: Session, entity_type: MediaEntityType, entity_id: uuid.UUID, legacy_fallback_url: str | None = None) -> str | None:
    """Implements the locked 30a.1 precedence:
    1. active primary MediaAsset
    2. legacy fallback URL (e.g. MenuItem.image_url), if provided
    3. None (frontend renders an approved placeholder)
    """
    primary = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type,
        MediaAsset.entity_id == entity_id,
        MediaAsset.is_active == True,  # noqa: E712
        MediaAsset.is_primary == True,  # noqa: E712
    ).first()
    if primary:
        return primary.url

    if legacy_fallback_url:
        return legacy_fallback_url

    return None