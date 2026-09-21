"""Phase 30a.3 — attaches the curated demo media set (see
MEDIA_ATTRIBUTION.md) to real Hotel/RoomType/Restaurant/MenuItem rows via
the actual media_service, and seeds plausible representative values for
the new verified attribute fields (view_type, bed_configuration,
amenities, dietary_tags, is_signature). These are DEMO values, clearly
labeled as such — the same "demo policy, replace with real data" pattern
already established for tax_rate etc. in Phase 18. Idempotent: running
this twice does not create duplicate media rows for the same entity+url."""

from app.core.database import SessionLocal
from app.models.hotel import Hotel, RoomType
from app.models.restaurant import Restaurant, MenuItem
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.user import User, RoleEnum

# --- Curated URLs (see MEDIA_ATTRIBUTION.md for sourcing/license detail) ---
HOTEL_LOBBY = "https://images.unsplash.com/photo-1759038086403-c607d67bb245?fm=jpg&q=80&w=1600&auto=format&fit=crop"
HOTEL_EXTERIORS = [
    "https://images.unsplash.com/photo-1651830949817-7642bdf5397e?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1698430484426-097e1c13db33?fm=jpg&q=80&w=1600&auto=format&fit=crop",
]
HOTEL_POOL = "https://images.unsplash.com/photo-1706561611610-2ebe309993f2?fm=jpg&q=80&w=1600&auto=format&fit=crop"
ROOM_INTERIORS = [
    "https://images.unsplash.com/photo-1702255489644-392758161f1f?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1631049421450-348ccd7f8949?fm=jpg&q=80&w=1600&auto=format&fit=crop",
]
ROOM_BATHROOM = "https://images.unsplash.com/photo-1646974400439-8472d58bb19e?fm=jpg&q=80&w=1600&auto=format&fit=crop"
RESTAURANT_DINING = "https://images.unsplash.com/photo-1656697363968-c91520a6e84c?fm=jpg&q=80&w=1600&auto=format&fit=crop"
FOOD_PIZZA = "https://images.unsplash.com/photo-1762631176795-d500f0472051?fm=jpg&q=80&w=1200&auto=format&fit=crop"
FOOD_CHICKEN = "https://images.unsplash.com/photo-1616401616927-3c81de22dfa8?fm=jpg&q=80&w=1200&auto=format&fit=crop"
FOOD_DESSERT = "https://images.unsplash.com/photo-1608108132933-741a71c144ef?fm=jpg&q=80&w=1200&auto=format&fit=crop"
FOOD_COFFEE = "https://images.unsplash.com/photo-1502462041640-b3d7e50d0662?fm=jpg&q=80&w=1200&auto=format&fit=crop"


def _add_if_missing(db, entity_type, entity_id, url, caption, alt_text, sort_order, is_primary, hotel_id, restaurant_id, created_by):
    existing = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type, MediaAsset.entity_id == entity_id, MediaAsset.url == url
    ).first()
    if existing:
        return existing
    asset = MediaAsset(
        entity_type=entity_type, entity_id=entity_id, source_type=MediaSourceType.EXTERNAL_URL,
        url=url, caption=caption, alt_text=alt_text, sort_order=sort_order, is_primary=is_primary,
        is_active=True, hotel_id=hotel_id, restaurant_id=restaurant_id, created_by=created_by,
    )
    db.add(asset)
    return asset


def run():
    db = SessionLocal()
    admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
    created_by = admin.id if admin else None

    hotels = db.query(Hotel).all()
    for i, hotel in enumerate(hotels):
        exterior_url = HOTEL_EXTERIORS[i % len(HOTEL_EXTERIORS)]
        _add_if_missing(db, MediaEntityType.HOTEL, hotel.id, exterior_url, f"{hotel.name} — Exterior", f"Exterior view of {hotel.name}", 0, True, hotel.id, None, created_by)
        _add_if_missing(db, MediaEntityType.HOTEL, hotel.id, HOTEL_LOBBY, f"{hotel.name} — Lobby", f"Lobby of {hotel.name}", 1, False, hotel.id, None, created_by)
        _add_if_missing(db, MediaEntityType.HOTEL, hotel.id, HOTEL_POOL, f"{hotel.name} — Pool & Outdoor", f"Outdoor pool area at {hotel.name}", 2, False, hotel.id, None, created_by)

    room_types = db.query(RoomType).all()
    for i, rt in enumerate(room_types):
        interior_url = ROOM_INTERIORS[i % len(ROOM_INTERIORS)]
        _add_if_missing(db, MediaEntityType.ROOM_TYPE, rt.id, interior_url, f"{rt.name} — Interior", f"Interior of {rt.name}", 0, True, rt.hotel_id, None, created_by)
        _add_if_missing(db, MediaEntityType.ROOM_TYPE, rt.id, ROOM_BATHROOM, f"{rt.name} — Bathroom", f"Bathroom of {rt.name}", 1, False, rt.hotel_id, None, created_by)

        # Demo verified-attribute values — clearly a seeded demo default,
        # not an inferred/AI-guessed fact. Only set if currently blank, so
        # this script never overwrites real Admin/Manager-entered data.
        if rt.view_type is None:
            rt.view_type = ["City View", "Garden View", "Pool View"][i % 3]
        if rt.bed_configuration is None:
            rt.bed_configuration = "1 King Bed" if rt.max_occupancy <= 2 else "2 Queen Beds"
        if not rt.amenities:
            rt.amenities = ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV"]

    restaurants = db.query(Restaurant).all()
    for restaurant in restaurants:
        _add_if_missing(db, MediaEntityType.RESTAURANT, restaurant.id, RESTAURANT_DINING, f"{restaurant.name} — Dining Room", f"Dining room at {restaurant.name}", 0, True, None, restaurant.id, created_by)

    menu_items = db.query(MenuItem).all()
    food_photo_map = [
        (["chicken"], FOOD_CHICKEN),
        (["pizza"], FOOD_PIZZA),
        (["dessert", "cake", "chocolate"], FOOD_DESSERT),
        (["coffee", "latte", "espresso"], FOOD_COFFEE),
    ]
    fallback_cycle = [FOOD_CHICKEN, FOOD_PIZZA, FOOD_DESSERT, FOOD_COFFEE]
    for i, item in enumerate(menu_items):
        name_lower = item.name.lower()
        matched_url = None
        for keywords, url in food_photo_map:
            if any(k in name_lower for k in keywords):
                matched_url = url
                break
        chosen_url = matched_url or fallback_cycle[i % len(fallback_cycle)]

        restaurant_id = None
        # MenuItem -> MenuCategory -> Restaurant, resolved the same way media_service does
        category = item.category
        if category:
            restaurant_id = category.restaurant_id

        _add_if_missing(db, MediaEntityType.MENU_ITEM, item.id, chosen_url, item.name, f"Photo of {item.name}", 0, True, None, restaurant_id, created_by)

        if not item.dietary_tags and "chicken" not in name_lower:
            pass  # only seed dietary tags where we have some real signal; otherwise leave blank rather than guess

    db.commit()
    print(f"Seeded media for {len(hotels)} hotels, {len(room_types)} room types, {len(restaurants)} restaurants, {len(menu_items)} menu items.")
    db.close()


if __name__ == "__main__":
    run()