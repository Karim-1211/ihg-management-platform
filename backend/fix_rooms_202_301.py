"""Corrects rooms 202 and 301, using their CURRENT numbers.

  Room 202 (old 204): its photographs show the ocean, so its type becomes
                      Ocean View Suite.
  Room 301 (old 306): an earlier repair overwrote its original lake photograph
                      with Room 201's balcony photo. The original is restored,
                      so 301 is genuinely a Lake & Mountain Suite and no
                      photograph is shared between two rooms.

Run from backend/:
    python fix_rooms_202_301.py            # report only, changes nothing
    python fix_rooms_202_301.py --apply    # make the changes
"""
import sys

from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.hotel import Room, RoomType
from app.models.media import MediaAsset
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.user import User  # noqa: F401

# The photograph Room 306 had before it was overwritten — the one described
# as garden, lake and mountains.
LAKE_MOUNTAIN_IMAGE = (
    "https://images.unsplash.com/photo-1532302780319-95689ab9d79a"
    "?fm=jpg&q=80&w=1600&auto=format&fit=crop"
)

INTERIOR_PARTS = ("Bedroom", "Bathroom", "Interior", "Balcony", "Lounge", "Detail", "Vanity")


def room_assets(db, room):
    return (
        db.query(MediaAsset)
        .filter(MediaAsset.entity_type == "ROOM", MediaAsset.entity_id == room.id)
        .all()
    )


def is_interior(asset) -> bool:
    caption = (asset.caption or "").lower()
    return any(part.lower() in caption for part in ("bedroom", "bathroom", "interior", "vanity"))


def number_key(room):
    digits = "".join(c for c in room.room_number if c.isdigit())
    return int(digits) if digits else 0


def report(db, title):
    types = {t.id: t for t in db.query(RoomType).all()}
    rooms = sorted(db.query(Room).all(), key=number_key)

    owners = {}
    for room in rooms:
        for asset in room_assets(db, room):
            owners.setdefault(asset.url, []).append(room.room_number)

    print(f"\n  {title}")
    print("  " + "=" * 78)
    for room in rooms:
        rt = types.get(room.room_type_id)
        print(f"\n  Room {room.room_number:<5} {rt.name if rt else '?':<24} view: {rt.view_type if rt else '?'}")
        for asset in room_assets(db, room):
            others = [n for n in owners.get(asset.url, []) if n != room.room_number]
            flag = f"   <-- SAME PHOTO AS ROOM {', '.join(others)}" if others else ""
            print(f"        {(asset.caption or '(no caption)'):<42}{flag}")
    print()


def run(apply: bool):
    db = SessionLocal()
    try:
        report(db, "CURRENT STATE")

        rooms = {r.room_number: r for r in db.query(Room).all()}
        types = {t.name: t for t in db.query(RoomType).all()}

        r201, r202, r301 = rooms.get("201"), rooms.get("202"), rooms.get("301")
        ocean = types.get("Ocean View Suite")
        lake_mountain = types.get("Lake & Mountain Suite")

        problems = []
        if not (r201 and r202 and r301):
            problems.append("rooms 201, 202 and 301 must all exist — has fix_rooms_and_types.py --apply been run?")
        if not ocean:
            problems.append("room type 'Ocean View Suite' not found")
        if not lake_mountain:
            problems.append("room type 'Lake & Mountain Suite' not found")
        if problems:
            for p in problems:
                print(f"  STOPPED: {p}")
            print()
            return

        # Which of 301's photographs is the one copied from 201?
        urls_on_201 = {a.url for a in room_assets(db, r201)}
        to_replace = [a for a in room_assets(db, r301) if a.url in urls_on_201 and not is_interior(a)]
        if not to_replace:
            # Fallback: the outlook photo (not bedroom or bathroom), if it is not
            # already the lake image.
            to_replace = [
                a for a in room_assets(db, r301)
                if not is_interior(a) and a.url != LAKE_MOUNTAIN_IMAGE
            ]

        print("  PLANNED CHANGES")
        print("  " + "-" * 78)
        print("    Room 202 : type -> Ocean View Suite (its photographs show the ocean)")
        print(f"    Room 301 : restore the original lake & mountain photograph ({len(to_replace)} image)")
        print("    Room 301 : type -> Lake & Mountain Suite")

        if not apply:
            print("\n  Nothing changed. Re-run with --apply to make these changes.\n")
            return

        # ---- Room 202 -> Ocean View Suite ---------------------------------
        if ocean.view_type != "Ocean View":
            ocean.view_type = "Ocean View"
        r202.room_type_id = ocean.id
        for asset in room_assets(db, r202):
            caption = asset.caption or ""
            part = next((p for p in INTERIOR_PARTS if p.lower() in caption.lower()), None)
            asset.caption = f"Room 202 — {part}" if part else "Room 202 — Ocean View"
            asset.alt_text = asset.caption

        # ---- Room 301: restore its own photograph -------------------------
        for asset in to_replace:
            asset.url = LAKE_MOUNTAIN_IMAGE
            asset.caption = "Room 301 — Lake & Mountain View"
            asset.alt_text = "Lake and mountain view from Room 301"

        # ---- Room 301 -> Lake & Mountain Suite ----------------------------
        r301.room_type_id = lake_mountain.id

        db.commit()
        report(db, "AFTER THE FIX")
        print("  Check above: no line should say 'SAME PHOTO AS ROOM'.\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run("--apply" in sys.argv)