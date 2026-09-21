"""Seed unique demo galleries for each physical hotel room.

Run from backend/:
    python refresh_demo_room_media.py

These are illustrative stock images only. They are not photographs of IHG
Grand Dhaka. Each physical room receives its own explicit gallery; no room
reuses another room's gallery.
"""
from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant  # noqa: F401 — required so SQLAlchemy can resolve MediaAsset.restaurant_id's FK

W = "?auto=compress&cs=tinysrgb&w=1800"

ROOM_MEDIA = {
    "204": [
        ("https://images.pexels.com/photos/34672504/pexels-photo-34672504.jpeg" + W, "Room 204 — Bedroom", "Demo Room 204 bedroom"),
        ("https://images.pexels.com/photos/8135526/pexels-photo-8135526.jpeg" + W, "Room 204 — Bathroom", "Demo Room 204 bathroom"),
        ("https://images.pexels.com/photos/19025564/pexels-photo-19025564.jpeg" + W, "Room 204 — Balcony View", "Demo Room 204 balcony view"),
    ],
    "305": [
        ("https://images.pexels.com/photos/32418081/pexels-photo-32418081.jpeg" + W, "Room 305 — Bedroom", "Demo Room 305 bedroom"),
        ("https://images.pexels.com/photos/37252314/pexels-photo-37252314.jpeg" + W, "Room 305 — Bathroom", "Demo Room 305 bathroom"),
        ("https://images.pexels.com/photos/34040619/pexels-photo-34040619.jpeg" + W, "Room 305 — City View", "Demo Room 305 city view"),
    ],
    "101": [
        ("https://images.pexels.com/photos/36852529/pexels-photo-36852529.jpeg" + W, "Room 101 — Bedroom", "Demo Room 101 bedroom"),
        ("https://images.pexels.com/photos/5461604/pexels-photo-5461604.jpeg" + W, "Room 101 — Bathroom", "Demo Room 101 bathroom"),
        ("https://images.pexels.com/photos/13723018/pexels-photo-13723018.jpeg" + W, "Room 101 — Interior", "Demo Room 101 interior"),
    ],
    "102": [
        ("https://images.pexels.com/photos/6394710/pexels-photo-6394710.jpeg" + W, "Room 102 — Bedroom", "Demo Room 102 bedroom"),
        ("https://images.pexels.com/photos/37734660/pexels-photo-37734660.jpeg" + W, "Room 102 — Bathroom", "Demo Room 102 bathroom"),
        ("https://images.pexels.com/photos/34108090/pexels-photo-34108090.jpeg" + W, "Room 102 — Window View", "Demo Room 102 window view"),
    ],
}


def seed_gallery(db, room, items, created_by):
    existing = db.query(MediaAsset).filter(
        MediaAsset.entity_type == MediaEntityType.ROOM,
        MediaAsset.entity_id == room.id,
    ).all()
    for row in existing:
        row.is_active = False
        row.is_primary = False

    for index, (url, caption, alt_text) in enumerate(items):
        asset = db.query(MediaAsset).filter(
            MediaAsset.entity_type == MediaEntityType.ROOM,
            MediaAsset.entity_id == room.id,
            MediaAsset.url == url,
        ).first()
        if asset is None:
            asset = MediaAsset(
                entity_type=MediaEntityType.ROOM,
                entity_id=room.id,
                source_type=MediaSourceType.EXTERNAL_URL,
                url=url,
                caption=caption,
                alt_text=alt_text,
                sort_order=index,
                is_primary=index == 0,
                is_active=True,
                hotel_id=room.hotel_id,
                created_by=created_by,
            )
            db.add(asset)
        else:
            asset.caption = caption
            asset.alt_text = alt_text
            asset.sort_order = index
            asset.is_primary = index == 0
            asset.is_active = True
            asset.hotel_id = room.hotel_id
            asset.created_by = created_by


def run():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        hotel = db.query(Hotel).filter(Hotel.name == "IHG Grand Dhaka").first()
        if not hotel:
            raise RuntimeError("IHG Grand Dhaka was not found. Run seed_data.py first.")

        rooms = db.query(Room).filter(Room.hotel_id == hotel.id).all()
        missing = [room.room_number for room in rooms if room.room_number not in ROOM_MEDIA]
        if missing:
            raise RuntimeError("Missing explicit gallery mapping for room(s): " + ", ".join(missing))

        for room in rooms:
            seed_gallery(db, room, ROOM_MEDIA[room.room_number], admin.id if admin else None)

        db.commit()
        print(f"Unique physical-room media refreshed: {len(rooms)} rooms")
        for room in rooms:
            print(f"  Room {room.room_number}: {len(ROOM_MEDIA[room.room_number])} unique images")
        print("NOTE: illustrative demo stock imagery only; not photographs of IHG Grand Dhaka.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()