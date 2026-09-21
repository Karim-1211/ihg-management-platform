"""Replace the demo hospitality imagery with unique, curated image sets.

Run from backend/:
    python refresh_demo_hotel_media_unique.py

Demo imagery only. Do not present these stock photos as actual photographs of
IHG Grand Dhaka. Real property photography can replace these URLs later.

Important: room mappings are explicit and NEVER cycle/reuse an image between
room types. If a new room type is added without a mapping, the script stops
with an error instead of silently assigning duplicate imagery.
"""

from app.core.database import SessionLocal
from app.models.hotel import Hotel, RoomType
from app.models.restaurant import Restaurant
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.user import User, RoleEnum

W = "?auto=compress&cs=tinysrgb&w=1800"

# ---------------------------------------------------------------------------
# HOTEL / PROPERTY — deliberately different subjects and compositions.
# ---------------------------------------------------------------------------
HOTEL_MEDIA = [
    ("https://images.pexels.com/photos/30866709/pexels-photo-30866709.jpeg" + W,
     "Property — Exterior Architecture", "Demo exterior architecture image"),
    ("https://images.pexels.com/photos/14012107/pexels-photo-14012107.jpeg" + W,
     "Property — Grand Entrance", "Demo grand hotel entrance image"),
    ("https://images.pexels.com/photos/37969730/pexels-photo-37969730.jpeg" + W,
     "Property — Lobby", "Demo luxury hotel lobby with marble and chandeliers"),
    ("https://images.pexels.com/photos/18204886/pexels-photo-18204886.jpeg" + W,
     "Property — Lobby Lounge", "Demo hotel lobby lounge image"),
    ("https://images.pexels.com/photos/17568098/pexels-photo-17568098.jpeg" + W,
     "Property — Pool", "Demo luxury hotel pool image"),
    ("https://images.pexels.com/photos/14022373/pexels-photo-14022373.jpeg" + W,
     "Property — Pool & Gardens", "Demo hotel pool and landscaped outdoor area"),
]

# ---------------------------------------------------------------------------
# ROOM TYPE — explicit unique galleries for the two current seed room types.
# Never reuse an image between these room types.
# ---------------------------------------------------------------------------
ROOM_MEDIA = {
    "Deluxe Suite": [
        ("https://images.pexels.com/photos/34672504/pexels-photo-34672504.jpeg" + W,
         "Deluxe Suite — Bedroom", "Demo Deluxe Suite bedroom"),
        ("https://images.pexels.com/photos/8135526/pexels-photo-8135526.jpeg" + W,
         "Deluxe Suite — Bathroom", "Demo Deluxe Suite bathroom"),
        ("https://images.pexels.com/photos/37658586/pexels-photo-37658586.jpeg" + W,
         "Deluxe Suite — View", "Demo Deluxe Suite pool-facing room view"),
        ("https://images.pexels.com/photos/27299153/pexels-photo-27299153.jpeg" + W,
         "Deluxe Suite — Vanity", "Demo Deluxe Suite bathroom vanity detail"),
    ],
    "Standard Room": [
        ("https://images.pexels.com/photos/36852529/pexels-photo-36852529.jpeg" + W,
         "Standard Room — Bedroom", "Demo Standard Room bedroom"),
        ("https://images.pexels.com/photos/8082564/pexels-photo-8082564.jpeg" + W,
         "Standard Room — Interior", "Demo Standard Room interior"),
        ("https://images.pexels.com/photos/8082195/pexels-photo-8082195.jpeg" + W,
         "Standard Room — Bathroom", "Demo Standard Room bathroom"),
        ("https://images.pexels.com/photos/18651506/pexels-photo-18651506.jpeg" + W,
         "Standard Room — Detail", "Demo Standard Room interior detail"),
    ],
}

# ---------------------------------------------------------------------------
# RESTAURANT — separate dining compositions; no room image reuse.
# ---------------------------------------------------------------------------
RESTAURANT_MEDIA = [
    ("https://images.pexels.com/photos/6877575/pexels-photo-6877575.jpeg" + W,
     "Restaurant — Dining Room", "Demo luxury hotel restaurant dining room"),
    ("https://images.pexels.com/photos/6877613/pexels-photo-6877613.jpeg" + W,
     "Restaurant — Evening Dining", "Demo elegant hotel restaurant interior"),
    ("https://images.pexels.com/photos/16199069/pexels-photo-16199069.jpeg" + W,
     "Restaurant — Buffet", "Demo upscale hotel buffet area"),
    ("https://images.pexels.com/photos/16985196/pexels-photo-16985196.jpeg" + W,
     "Restaurant — Dining Detail", "Demo refined restaurant seating and lighting"),
]


def deactivate_existing(db, entity_type, entity_id):
    rows = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type,
        MediaAsset.entity_id == entity_id,
    ).all()
    for row in rows:
        row.is_active = False
        row.is_primary = False


def add_asset(db, *, entity_type, entity_id, url, caption, alt_text,
              sort_order, hotel_id=None, restaurant_id=None, created_by=None):
    asset = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type,
        MediaAsset.entity_id == entity_id,
        MediaAsset.url == url,
    ).first()

    if asset is None:
        asset = MediaAsset(
            entity_type=entity_type,
            entity_id=entity_id,
            source_type=MediaSourceType.EXTERNAL_URL,
            url=url,
            caption=caption,
            alt_text=alt_text,
            sort_order=sort_order,
            is_primary=(sort_order == 0),
            is_active=True,
            hotel_id=hotel_id,
            restaurant_id=restaurant_id,
            created_by=created_by,
        )
        db.add(asset)
    else:
        asset.caption = caption
        asset.alt_text = alt_text
        asset.sort_order = sort_order
        asset.is_primary = sort_order == 0
        asset.is_active = True
        asset.hotel_id = hotel_id
        asset.restaurant_id = restaurant_id


def seed_gallery(db, entity_type, entity_id, items, hotel_id=None, restaurant_id=None, created_by=None):
    deactivate_existing(db, entity_type, entity_id)
    for index, (url, caption, alt_text) in enumerate(items):
        add_asset(
            db,
            entity_type=entity_type,
            entity_id=entity_id,
            url=url,
            caption=caption,
            alt_text=alt_text,
            sort_order=index,
            hotel_id=hotel_id,
            restaurant_id=restaurant_id,
            created_by=created_by,
        )


def run():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        created_by = admin.id if admin else None

        hotel = db.query(Hotel).filter(Hotel.name == "IHG Grand Dhaka").first()
        if not hotel:
            raise RuntimeError("IHG Grand Dhaka was not found. Run seed_data.py first.")

        # Hotel landing gallery.
        seed_gallery(
            db, MediaEntityType.HOTEL, hotel.id, HOTEL_MEDIA,
            hotel_id=hotel.id, created_by=created_by,
        )

        # Every existing room type MUST have an explicit gallery mapping.
        room_types = db.query(RoomType).filter(RoomType.hotel_id == hotel.id).all()
        missing = [rt.name for rt in room_types if rt.name not in ROOM_MEDIA]
        if missing:
            raise RuntimeError(
                "No unique image set defined for room type(s): " + ", ".join(missing)
                + ". Add an explicit ROOM_MEDIA entry instead of reusing images."
            )

        for rt in room_types:
            seed_gallery(
                db, MediaEntityType.ROOM_TYPE, rt.id, ROOM_MEDIA[rt.name],
                hotel_id=hotel.id, created_by=created_by,
            )

        # Restaurant landing gallery.
        for restaurant in db.query(Restaurant).all():
            seed_gallery(
                db, MediaEntityType.RESTAURANT, restaurant.id, RESTAURANT_MEDIA,
                restaurant_id=restaurant.id, created_by=created_by,
            )

        db.commit()
        print("Unique demo hospitality media refreshed successfully.")
        print(f"Hotel: {len(HOTEL_MEDIA)} unique images")
        for rt in room_types:
            print(f"{rt.name}: {len(ROOM_MEDIA[rt.name])} unique images")
        print(f"Restaurants: {len(RESTAURANT_MEDIA)} unique images per restaurant")
        print("\nNOTE: Images are illustrative demo stock imagery, not photographs of IHG Grand Dhaka.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()