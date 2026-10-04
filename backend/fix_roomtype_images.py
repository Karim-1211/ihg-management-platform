"""Gives every room type a primary photograph.

A room type created after the original seeding has no media of its own, so
any card that shows TYPES rather than rooms renders "No image available"
even though the rooms inside it have pictures.

The new row is built by copying an existing media row's own columns, so it
matches whatever MediaAsset actually defines — no column names are assumed.

Run from backend/:
    python fix_roomtype_images.py            # report only
    python fix_roomtype_images.py --fix      # attach the missing images
"""
import sys

from sqlalchemy import inspect as sa_inspect

from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.hotel import Room, RoomType
from app.models.media import MediaAsset
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.user import User  # noqa: F401

# A card shows the room at its best, so an outlook or a bedroom is
# preferred over a bathroom.
PREFERRED = ("view", "bedroom", "interior", "balcony")


def pick_image(assets):
    for word in PREFERRED:
        for asset in assets:
            if word in (asset.caption or "").lower():
                return asset
    return assets[0] if assets else None


def clone_for_room_type(source: MediaAsset, room_type: RoomType) -> MediaAsset:
    """Copies every column of an existing media row except its identity,
    then re-points it at the room type. Reading the columns from the model
    means this works whatever MediaAsset defines."""
    columns = [c.key for c in sa_inspect(MediaAsset).mapper.column_attrs]
    values = {}
    for name in columns:
        if name in ("id", "created_at", "updated_at", "entity_type", "entity_id"):
            continue
        values[name] = getattr(source, name)

    values["entity_type"] = "ROOM_TYPE"
    values["entity_id"] = room_type.id
    if "caption" in values:
        values["caption"] = f"{room_type.name} — {room_type.view_type or 'View'}"
    if "alt_text" in values:
        values["alt_text"] = f"{room_type.name} at IHG Grand Dhaka"

    return MediaAsset(**values)


def run(apply: bool):
    db = SessionLocal()
    try:
        types = db.query(RoomType).order_by(RoomType.name).all()
        print(f"\n  {len(types)} room type(s)\n  " + "-" * 66)

        missing = []
        for rt in types:
            own = db.query(MediaAsset).filter(
                MediaAsset.entity_type == "ROOM_TYPE", MediaAsset.entity_id == rt.id
            ).count()
            rooms = db.query(Room).filter(Room.room_type_id == rt.id).all()
            print(f"    {rt.name:<24} {own} type image(s), {len(rooms)} room(s)")
            if own == 0:
                missing.append((rt, rooms))

        if not missing:
            print("\n  Every room type already has a photograph.\n")
            return

        if not apply:
            print(f"\n  {len(missing)} type(s) with no photograph. Re-run with --fix to attach them.\n")
            return

        added = 0
        for rt, rooms in missing:
            source = None
            for room in rooms:
                assets = db.query(MediaAsset).filter(
                    MediaAsset.entity_type == "ROOM", MediaAsset.entity_id == room.id
                ).all()
                source = pick_image(assets)
                if source:
                    break
            if not source:
                print(f"  ! {rt.name}: no room photograph to copy")
                continue

            db.add(clone_for_room_type(source, rt))
            added += 1
            print(f"  + {rt.name}: photograph attached")

        db.commit()
        print(f"\n  {added} photograph(s) attached.\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run("--fix" in sys.argv)