"""One-off script: adds two new premium room types with real view labels
(Ocean View Suite / Mountain View Suite), each with one physical room and
its own unique verified photo gallery — so the AI Concierge and the
"Views" showcase on the hotel page describe the same real, bookable rooms
instead of the Views section being aspirational-only imagery.

Run from backend/:
    python add_premium_view_rooms.py
"""
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room, RoomType, RoomStatus
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant  # noqa: F401 — needed for MediaAsset.restaurant_id FK resolution

NEW_ROOM_TYPES = {
    "Ocean View Suite": {
        "description": "A premium suite facing the water, with a private balcony.",
        "base_price": Decimal("170.00"),
        "max_occupancy": 2,
        "view_type": "Sea View",
        "bed_configuration": "1 King Bed",
        "has_balcony": True,
        "has_bathtub": True,
        "amenities": ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV", "Private Balcony"],
        "room_number": "401",
        "floor": 4,
        "images": [
            ("https://images.unsplash.com/photo-1629078691977-dc51747c0263?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Bedroom", "Ocean View Suite bedroom"),
            ("https://images.unsplash.com/photo-1648631478953-1334ce24a24c?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Bathroom", "Ocean View Suite bathroom"),
            ("https://images.unsplash.com/photo-1664189767954-e4e605ae46da?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Ocean View Suite — Sea View", "Ocean View Suite sea view balcony"),
        ],
    },
    "Mountain View Suite": {
        "description": "A warm, wood-toned suite looking out over the mountains.",
        "base_price": Decimal("165.00"),
        "max_occupancy": 2,
        "view_type": "Mountain View",
        "bed_configuration": "1 King Bed",
        "has_balcony": True,
        "has_bathtub": False,
        "amenities": ["Free Wi-Fi", "Air Conditioning", "Mini Bar", "Flat-Screen TV", "Private Balcony"],
        "room_number": "402",
        "floor": 4,
        "images": [
            ("https://images.unsplash.com/photo-1600054648630-e10e710825f6?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Bedroom", "Mountain View Suite bedroom"),
            ("https://images.unsplash.com/photo-1552143232-454554411763?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Bathroom", "Mountain View Suite bathroom"),
            ("https://images.unsplash.com/photo-1664967231678-64af98ccbfce?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Mountain View Suite — Mountain View", "Mountain View Suite mountain view"),
        ],
    },
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

        created_types = []
        created_rooms = []

        for type_name, spec in NEW_ROOM_TYPES.items():
            room_type = db.query(RoomType).filter(
                RoomType.hotel_id == hotel.id, RoomType.name == type_name
            ).first()
            if room_type is None:
                room_type = RoomType(
                    hotel_id=hotel.id,
                    name=type_name,
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
                created_types.append(type_name)
            elif not room_type.view_type:
                room_type.view_type = spec["view_type"]

            seed_gallery(db, MediaEntityType.ROOM_TYPE, room_type.id, hotel.id, spec["images"], admin.id if admin else None)

            room = db.query(Room).filter(
                Room.hotel_id == hotel.id, Room.room_number == spec["room_number"]
            ).first()
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
                created_rooms.append(spec["room_number"])
            else:
                room.status = RoomStatus.READY

            seed_gallery(db, MediaEntityType.ROOM, room.id, hotel.id, spec["images"], admin.id if admin else None)

        db.commit()
        print(f"Created {len(created_types)} new room type(s): {', '.join(created_types) if created_types else '(none — already existed)'}")
        print(f"Created {len(created_rooms)} new room(s): {', '.join(created_rooms) if created_rooms else '(none — already existed)'}")
        print("NOTE: illustrative demo stock imagery only; not photographs of IHG Grand Dhaka.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()