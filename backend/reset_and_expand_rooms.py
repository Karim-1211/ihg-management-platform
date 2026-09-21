"""One-off demo maintenance script: resets every room at IHG Grand Dhaka to
READY (so nothing shows as stuck "out of service" in the demo), and adds
two more physical rooms with their own unique verified photo galleries.
Safe to re-run — room/media creation is idempotent by room_number / URL.

Run from backend/:
    python reset_and_expand_rooms.py
"""
from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room, RoomType, RoomStatus
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant  # noqa: F401 — needed for MediaAsset.restaurant_id FK resolution

NEW_ROOMS = {
    "103": {
        "type_keyword": "standard",
        "images": [
            ("https://images.unsplash.com/photo-1631049421450-348ccd7f8949?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Room 103 — Bedroom", "Demo Room 103 bedroom"),
            ("https://images.unsplash.com/photo-1664227430687-9299c593e3da?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Room 103 — Bathroom", "Demo Room 103 bathroom"),
            ("https://images.unsplash.com/photo-1617143182876-2f05a7227363?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Room 103 — Interior", "Demo Room 103 interior"),
        ],
    },
    "306": {
        "type_keyword": "deluxe",
        "images": [
            ("https://images.unsplash.com/photo-1559599238-308793637427?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Room 306 — Bedroom", "Demo Room 306 bedroom"),
            ("https://images.unsplash.com/photo-1646974400439-8472d58bb19e?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Room 306 — Bathroom", "Demo Room 306 bathroom"),
            ("https://images.unsplash.com/photo-1532302780319-95689ab9d79a?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Room 306 — Garden & Lake View", "Demo Room 306 garden and lake view"),
        ],
    },
}


def find_room_type(db, hotel_id, keyword):
    types = db.query(RoomType).filter(RoomType.hotel_id == hotel_id).all()
    matches = [t for t in types if keyword.lower() in t.name.lower()]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected exactly one room type matching '{keyword}', found {len(matches)}: {[t.name for t in matches]}"
        )
    return matches[0]


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

        all_rooms = db.query(Room).filter(Room.hotel_id == hotel.id).all()
        reset_count = 0
        for room in all_rooms:
            if room.status != RoomStatus.READY:
                room.status = RoomStatus.READY
                reset_count += 1

        created = []
        for room_number, spec in NEW_ROOMS.items():
            room = db.query(Room).filter(Room.hotel_id == hotel.id, Room.room_number == room_number).first()
            if room is None:
                room_type = find_room_type(db, hotel.id, spec["type_keyword"])
                sibling = db.query(Room).filter(
                    Room.hotel_id == hotel.id, Room.room_type_id == room_type.id
                ).first()
                floor = sibling.floor if sibling and sibling.floor is not None else 1
                room = Room(
                    hotel_id=hotel.id,
                    room_type_id=room_type.id,
                    room_number=room_number,
                    floor=floor,
                    status=RoomStatus.READY,
                )
                db.add(room)
                db.flush()
                created.append(room_number)
            else:
                room.status = RoomStatus.READY

            seed_gallery(db, room, spec["images"], admin.id if admin else None)

        db.commit()

        print(f"Reset {reset_count} existing room(s) to READY.")
        print(f"Created {len(created)} new room(s): {', '.join(created) if created else '(none — already existed)'}")
        print("All rooms (existing + new) are now READY with unique galleries.")
        print("NOTE: illustrative demo stock imagery only; not photographs of IHG Grand Dhaka.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()