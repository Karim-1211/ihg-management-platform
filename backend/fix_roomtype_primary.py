"""Makes sure every room type has an ACTIVE, PRIMARY photograph.

Cards that show room TYPES use only an image that is both active and
primary (media_service.resolve_primary_image_url). A type whose images are
inactive, or none of them primary, shows "No image available".

Prints the state of every image first, so the cause is visible rather than
assumed.

Run from backend/:
    python fix_roomtype_primary.py
"""
from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.hotel import RoomType
from app.models.media import MediaAsset
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.user import User  # noqa: F401


def run():
    db = SessionLocal()
    try:
        fixed = 0
        for rt in db.query(RoomType).order_by(RoomType.name).all():
            images = (
                db.query(MediaAsset)
                .filter(MediaAsset.entity_type == "ROOM_TYPE", MediaAsset.entity_id == rt.id)
                .order_by(MediaAsset.sort_order)
                .all()
            )
            print(f"\n  {rt.name}: {len(images)} image(s)")
            for i in images:
                print(f"      active={str(i.is_active):<5} primary={str(i.is_primary):<5} {(i.caption or '')[:44]}")

            if not images:
                print("      ! no images at all")
                continue

            has_good_primary = any(i.is_active and i.is_primary for i in images)
            if has_good_primary:
                print("      ok")
                continue

            # Prefer an image that is already active; otherwise activate the first.
            chosen = next((i for i in images if i.is_active), images[0])
            for i in images:
                i.is_primary = False
            chosen.is_active = True
            chosen.is_primary = True
            fixed += 1
            print(f"      + fixed: '{(chosen.caption or '')[:44]}' is now active and primary")

        db.commit()
        print(f"\n  {fixed} room type(s) fixed.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()