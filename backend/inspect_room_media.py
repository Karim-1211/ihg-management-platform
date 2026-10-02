"""Lists every room and room-type image with its caption, so mismatches
between a photograph and the room it is attached to can be seen rather than
guessed at.

Run from backend/:
    python inspect_room_media.py
"""
from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.hotel import Room, RoomType
from app.models.media import MediaAsset


def run():
    db = SessionLocal()
    try:
        types = {rt.id: rt for rt in db.query(RoomType).all()}
        rooms = {r.id: r for r in db.query(Room).all()}

        type_media = db.query(MediaAsset).filter(MediaAsset.entity_type == "ROOM_TYPE").all()
        print(f"\n  ROOM TYPE IMAGES ({len(type_media)})\n" + "=" * 100)
        by_type = {}
        for m in type_media:
            by_type.setdefault(m.entity_id, []).append(m)
        for type_id, assets in by_type.items():
            rt = types.get(type_id)
            print(f"\n  {rt.name if rt else 'unknown'}  (stored view: {rt.view_type if rt else '?'})")
            for m in assets:
                label = m.caption or m.alt_text or "(no caption)"
                print(f"      {label[:46]:<48} {m.url[:72]}")

        room_media = db.query(MediaAsset).filter(MediaAsset.entity_type == "ROOM").all()
        print(f"\n\n  ROOM-SPECIFIC IMAGES ({len(room_media)})\n" + "=" * 100)
        by_room = {}
        for m in room_media:
            by_room.setdefault(m.entity_id, []).append(m)
        for room_id, assets in by_room.items():
            room = rooms.get(room_id)
            rt = types.get(room.room_type_id) if room else None
            print(f"\n  Room {room.room_number if room else '?'}  ({rt.name if rt else '?'})")
            for m in assets:
                label = m.caption or m.alt_text or "(no caption)"
                print(f"      {label[:46]:<48} {m.url[:72]}")
        print()
    finally:
        db.close()


if __name__ == "__main__":
    run()