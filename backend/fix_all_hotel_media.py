"""Consolidated fix — safe to run regardless of what earlier scripts did or
didn't do (everything here is create-or-update, never assumes prior state):

1. Replaces the hotel's hero imagery — the previous set included an
   unrelated statue and visible "THE WESTIN" signage, both wrong for this
   hotel's own branding.
2. Ensures Ocean View Suite (401), Mountain View Suite (402), and Lake
   View Suite (403) exist, each with an unmistakable, verified cover photo
   matching its name.
3. Converts Room 103 from Standard Room into a new City View Room type,
   keeping its existing bedroom/bathroom photos and adding a real city
   skyline cover.

Run from backend/:
    python fix_all_hotel_media.py
"""
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room, RoomType, RoomStatus
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant  # noqa: F401 — needed for MediaAsset.restaurant_id FK resolution

HOTEL_HERO_IMAGES = [
    ("https://images.unsplash.com/photo-1651830949817-7642bdf5397e?fm=jpg&q=80&w=2600&auto=format&fit=crop", "IHG Grand Dhaka — Exterior", "Hotel exterior with palm trees"),
    ("https://images.unsplash.com/photo-1739304150315-26a8676d01ef?fm=jpg&q=80&w=2600&auto=format&fit=crop", "IHG Grand Dhaka — Aerial View", "Aerial view of resort grounds"),
]

VIEW_SUITE_TYPES = {
    "Ocean View Suite": {
        "description": "A premium suite facing the water, with a private balcony.",
        "base_price": Decimal("170.00"), "max_occupancy": 2, "view_type": "Sea View",
        "bed_configuration": "1 King Bed", "has_balcony": True, "has_bathtub": True,
        "amenities": ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV", "Private Balcony"],
        "room_number": "401", "floor": 4,
        "images": [
            ("https://images.unsplash.com/photo-1757839939502-afa95e78dd60?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Ocean View", "Hotel overlooking the ocean"),
            ("https://images.unsplash.com/photo-1629078691977-dc51747c0263?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Bedroom", "Ocean View Suite bedroom"),
            ("https://images.unsplash.com/photo-1648631478953-1334ce24a24c?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Bathroom", "Ocean View Suite bathroom"),
        ],
    },
    "Mountain View Suite": {
        "description": "A warm, wood-toned suite looking out over the mountains.",
        "base_price": Decimal("165.00"), "max_occupancy": 2, "view_type": "Mountain View",
        "bed_configuration": "1 King Bed", "has_balcony": True, "has_bathtub": False,
        "amenities": ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV", "Private Balcony"],
        "room_number": "402", "floor": 4,
        "images": [
            ("https://images.unsplash.com/photo-1664967231678-64af98ccbfce?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Mountain View", "Mountain View Suite mountain view"),
            ("https://images.unsplash.com/photo-1600054648630-e10e710825f6?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Bedroom", "Mountain View Suite bedroom"),
            ("https://images.unsplash.com/photo-1552143232-454554411763?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Bathroom", "Mountain View Suite bathroom"),
        ],
    },
    "Lake View Suite": {
        "description": "A calm, wood-toned suite overlooking the lake.",
        "base_price": Decimal("160.00"), "max_occupancy": 2, "view_type": "Lake View",
        "bed_configuration": "1 King Bed", "has_balcony": True, "has_bathtub": False,
        "amenities": ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV", "Private Balcony"],
        "room_number": "403", "floor": 4,
        "images": [
            ("https://images.unsplash.com/photo-1765571093286-e492fd3ca368?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Lake View Suite — Lake View", "Turquoise lake with mountains"),
            ("https://images.unsplash.com/photo-1702255489644-392758161f1f?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Lake View Suite — Bedroom", "Lake View Suite bedroom"),
            ("https://images.unsplash.com/photo-1757787737175-cd3eb263a264?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Lake View Suite — Bathroom", "Lake View Suite bathroom"),
        ],
    },
}

CITY_VIEW_TYPE = {
    "name": "City View Room",
    "description": "A Standard Room with a real city skyline outlook.",
    "base_price": Decimal("80.00"), "max_occupancy": 2, "view_type": "City View",
    "bed_configuration": "1 King Bed", "has_balcony": False, "has_bathtub": False,
    "amenities": ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV"],
    "room_number": "103",  # converts the existing Standard Room 103
    "view_image": ("https://images.unsplash.com/photo-1750072167202-b54f7a2c6bc7?fm=jpg&q=80&w=1800&auto=format&fit=crop", "City View Room — City View", "City skyline from hotel window"),
}


def seed_gallery(db, entity_type, entity_id, hotel_id, items, created_by):
    existing = db.query(MediaAsset).filter(
        MediaAsset.entity_type == entity_type, MediaAsset.entity_id == entity_id,
    ).all()
    for row in existing:
        row.is_active = False
        row.is_primary = False

    for index, (url, caption, alt_text) in enumerate(items):
        asset = db.query(MediaAsset).filter(
            MediaAsset.entity_type == entity_type, MediaAsset.entity_id == entity_id, MediaAsset.url == url,
        ).first()
        if asset is None:
            asset = MediaAsset(
                entity_type=entity_type, entity_id=entity_id, source_type=MediaSourceType.EXTERNAL_URL,
                url=url, caption=caption, alt_text=alt_text, sort_order=index, is_primary=index == 0,
                is_active=True, hotel_id=hotel_id, created_by=created_by,
            )
            db.add(asset)
        else:
            asset.caption, asset.alt_text, asset.sort_order = caption, alt_text, index
            asset.is_primary, asset.is_active, asset.hotel_id, asset.created_by = index == 0, True, hotel_id, created_by


def ensure_view_suite(db, hotel, admin_id, type_name, spec):
    room_type = db.query(RoomType).filter(RoomType.hotel_id == hotel.id, RoomType.name == type_name).first()
    if room_type is None:
        room_type = RoomType(
            hotel_id=hotel.id, name=type_name, description=spec["description"], base_price=spec["base_price"],
            max_occupancy=spec["max_occupancy"], view_type=spec["view_type"], bed_configuration=spec["bed_configuration"],
            has_balcony=spec["has_balcony"], has_bathtub=spec["has_bathtub"], amenities=spec["amenities"],
        )
        db.add(room_type)
        db.flush()

    seed_gallery(db, MediaEntityType.ROOM_TYPE, room_type.id, hotel.id, spec["images"], admin_id)

    room = db.query(Room).filter(Room.hotel_id == hotel.id, Room.room_number == spec["room_number"]).first()
    if room is None:
        room = Room(hotel_id=hotel.id, room_type_id=room_type.id, room_number=spec["room_number"], floor=spec["floor"], status=RoomStatus.READY)
        db.add(room)
        db.flush()
    else:
        room.status = RoomStatus.READY

    seed_gallery(db, MediaEntityType.ROOM, room.id, hotel.id, spec["images"], admin_id)


def run():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        admin_id = admin.id if admin else None
        hotel = db.query(Hotel).filter(Hotel.name == "IHG Grand Dhaka").first()
        if not hotel:
            raise RuntimeError("IHG Grand Dhaka was not found. Run seed_data.py first.")

        seed_gallery(db, MediaEntityType.HOTEL, hotel.id, hotel.id, HOTEL_HERO_IMAGES, admin_id)
        print("Hotel hero images replaced.")

        for type_name, spec in VIEW_SUITE_TYPES.items():
            ensure_view_suite(db, hotel, admin_id, type_name, spec)
            print(f"  {type_name} (Room {spec['room_number']}): ready.")

        room_103 = db.query(Room).filter(Room.hotel_id == hotel.id, Room.room_number == CITY_VIEW_TYPE["room_number"]).first()
        if not room_103:
            raise RuntimeError("Room 103 was not found — cannot convert it to City View Room.")

        city_type = db.query(RoomType).filter(RoomType.hotel_id == hotel.id, RoomType.name == CITY_VIEW_TYPE["name"]).first()
        if city_type is None:
            city_type = RoomType(
                hotel_id=hotel.id, name=CITY_VIEW_TYPE["name"], description=CITY_VIEW_TYPE["description"],
                base_price=CITY_VIEW_TYPE["base_price"], max_occupancy=CITY_VIEW_TYPE["max_occupancy"],
                view_type=CITY_VIEW_TYPE["view_type"], bed_configuration=CITY_VIEW_TYPE["bed_configuration"],
                has_balcony=CITY_VIEW_TYPE["has_balcony"], has_bathtub=CITY_VIEW_TYPE["has_bathtub"],
                amenities=CITY_VIEW_TYPE["amenities"],
            )
            db.add(city_type)
            db.flush()

        existing_room_images = db.query(MediaAsset).filter(
            MediaAsset.entity_type == MediaEntityType.ROOM, MediaAsset.entity_id == room_103.id, MediaAsset.is_active == True,  # noqa: E712
        ).order_by(MediaAsset.sort_order).all()
        bedroom_bathroom = [(a.url, a.caption, a.alt_text) for a in existing_room_images if "Bedroom" in (a.caption or "") or "Bathroom" in (a.caption or "")]
        city_images = [CITY_VIEW_TYPE["view_image"]] + bedroom_bathroom

        room_103.room_type_id = city_type.id
        room_103.status = RoomStatus.READY
        seed_gallery(db, MediaEntityType.ROOM_TYPE, city_type.id, hotel.id, city_images, admin_id)
        seed_gallery(db, MediaEntityType.ROOM, room_103.id, hotel.id, city_images, admin_id)
        print("Room 103 converted to City View Room.")

        db.commit()
        print("Done. NOTE: illustrative demo stock imagery only; not photographs of IHG Grand Dhaka.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()