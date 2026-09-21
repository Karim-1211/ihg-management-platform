"""One-off script:
1. Fixes the cover photo for Ocean View Suite (401) and Mountain View
   Suite (402) — the view photo now comes first (primary/cover image)
   instead of the bedroom photo, so the room card actually shows water /
   mountains at a glance, matching the room's name.
2. Adds a new Lake View Suite (room 403) with its own room type and a
   fresh, verified 3-photo gallery.

Run from backend/:
    python add_lake_view_and_fix_covers.py
"""
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room, RoomType, RoomStatus
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant  # noqa: F401 — needed for MediaAsset.restaurant_id FK resolution

FIXED_COVER_ORDER = {
    "401": [
        ("https://images.unsplash.com/photo-1664189767954-e4e605ae46da?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Sea View", "Ocean View Suite sea view balcony"),
        ("https://images.unsplash.com/photo-1629078691977-dc51747c0263?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Bedroom", "Ocean View Suite bedroom"),
        ("https://images.unsplash.com/photo-1648631478953-1334ce24a24c?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Bathroom", "Ocean View Suite bathroom"),
    ],
    "402": [
        ("https://images.unsplash.com/photo-1664967231678-64af98ccbfce?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Mountain View", "Mountain View Suite mountain view"),
        ("https://images.unsplash.com/photo-1600054648630-e10e710825f6?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Bedroom", "Mountain View Suite bedroom"),
        ("https://images.unsplash.com/photo-1552143232-454554411763?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Bathroom", "Mountain View Suite bathroom"),
    ],
}

NEW_ROOM_TYPE = {
    "name": "Lake View Suite",
    "description": "A calm, wood-toned suite overlooking the lake.",
    "base_price": Decimal("160.00"),
    "max_occupancy": 2,
    "view_type": "Lake View",
    "bed_configuration": "1 King Bed",
    "has_balcony": True,
    "has_bathtub": False,
    "amenities": ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV", "Private Balcony"],
    "room_number": "403",
    "floor": 4,
    "images": [
        ("https://images.unsplash.com/photo-1665993585834-ec5c128ac85a?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Lake View Suite — Lake View", "Lake View Suite lake view"),
        ("https://images.unsplash.com/photo-1702255489644-392758161f1f?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Lake View Suite — Bedroom", "Lake View Suite bedroom"),
        ("https://images.unsplash.com/photo-1757787737175-cd3eb263a264?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Lake View Suite — Bathroom", "Lake View Suite bathroom"),
    ],
}


def seed_gallery(db, entity_type, entity_id, hotel_id, items, created_by):
    existing = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type,
        MediaAsset.entity_id == entity_id,
    ).all()
    for row in existing:
        row.is_active = False
        row.is_primary = False

    for index, (url, caption, alt_text) in enumerate(items):
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
                sort_order=index,
                is_primary=index == 0,
                is_active=True,
                hotel_id=hotel_id,
                created_by=created_by,
            )
            db.add(asset)
        else:
            asset.caption = caption
            asset.alt_text = alt_text
            asset.sort_order = index
            asset.is_primary = index == 0
            asset.is_active = True
            asset.hotel_id = hotel_id
            asset.created_by = created_by


def run():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        hotel = db.query(Hotel).filter(Hotel.name == "IHG Grand Dhaka").first()
        if not hotel:
            raise RuntimeError("IHG Grand Dhaka was not found. Run seed_data.py first.")

        fixed = []
        for room_number, images in FIXED_COVER_ORDER.items():
            room = db.query(Room).filter(Room.hotel_id == hotel.id, Room.room_number == room_number).first()
            if not room:
                print(f"  Skipped {room_number}: room not found.")
                continue
            seed_gallery(db, MediaEntityType.ROOM, room.id, hotel.id, images, admin.id if admin else None)
            seed_gallery(db, MediaEntityType.ROOM_TYPE, room.room_type_id, hotel.id, images, admin.id if admin else None)
            fixed.append(room_number)

        spec = NEW_ROOM_TYPE
        room_type = db.query(RoomType).filter(RoomType.hotel_id == hotel.id, RoomType.name == spec["name"]).first()
        created_type = False
        if room_type is None:
            room_type = RoomType(
                hotel_id=hotel.id,
                name=spec["name"],
                description=spec["description"],
                base_price=spec["base_price"],
                max_occupancy=spec["max_occupancy"],
                view_type=spec["view_type"],
                bed_configuration=spec["bed_configuration"],
                has_balcony=spec["has_balcony"],
                has_bathtub=spec["has_bathtub"],
                amenities=spec["amenities"],
            )
            db.add(room_type)
            db.flush()
            created_type = True

        seed_gallery(db, MediaEntityType.ROOM_TYPE, room_type.id, hotel.id, spec["images"], admin.id if admin else None)

        room = db.query(Room).filter(Room.hotel_id == hotel.id, Room.room_number == spec["room_number"]).first()
        created_room = False
        if room is None:
            room = Room(
                hotel_id=hotel.id,
                room_type_id=room_type.id,
                room_number=spec["room_number"],
                floor=spec["floor"],
                status=RoomStatus.READY,
            )
            db.add(room)
            db.flush()
            created_room = True
        else:
            room.status = RoomStatus.READY

        seed_gallery(db, MediaEntityType.ROOM, room.id, hotel.id, spec["images"], admin.id if admin else None)

        db.commit()
        print(f"Fixed cover image order for: {', '.join(fixed) if fixed else '(none found)'}")
        print(f"Lake View Suite room type: {'created' if created_type else 'already existed, media refreshed'}")
        print(f"Room 403: {'created' if created_room else 'already existed, media refreshed'}")
        print("NOTE: illustrative demo stock imagery only; not photographs of IHG Grand Dhaka.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()