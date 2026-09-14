"""Phase 30a.1 — isolated structural verification of the media/attribute
migration. No business logic yet (that's 30a.2) — this only confirms the
schema and ORM models are correctly in place and queryable."""

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.hotel import RoomType, Hotel
from app.models.restaurant import MenuItem, MenuCategory


def run():
    db = SessionLocal()
    passed = 0
    failed = 0

    def check(label, condition):
        nonlocal passed, failed
        if condition:
            print(f"   OK - {label}")
            passed += 1
        else:
            print(f"   FAILED - {label}")
            failed += 1

    try:
        print("1. media_assets table is empty (no data was inserted by the migration)...")
        count = db.query(MediaAsset).count()
        check("zero rows", count == 0)

        print("\n2. RoomType has the new columns with correct defaults...")
        room_type = db.query(RoomType).first()
        if room_type:
            check("view_type is None by default", room_type.view_type is None)
            check("has_balcony defaults to False", room_type.has_balcony is False)
            check("has_bathtub defaults to False", room_type.has_bathtub is False)
            check("amenities defaults to empty list", room_type.amenities == [])
        else:
            print("   SKIPPED - no RoomType row exists to inspect.")

        print("\n3. MenuItem has the new columns with correct defaults...")
        menu_item = db.query(MenuItem).first()
        if menu_item:
            check("dietary_tags defaults to empty list", menu_item.dietary_tags == [])
            check("is_signature defaults to False", menu_item.is_signature is False)
            check("existing image_url field untouched/still accessible", hasattr(menu_item, "image_url"))
        else:
            print("   SKIPPED - no MenuItem row exists to inspect.")

        print("\n4. A MediaAsset row can be created and read back correctly (polymorphic, no FK on entity_id)...")
        real_hotel = db.query(Hotel).first()
        if real_hotel:
            test_asset = MediaAsset(
                entity_type=MediaEntityType.HOTEL,
                entity_id=real_hotel.id,
                source_type=MediaSourceType.EXTERNAL_URL,
                url="https://example.com/test-image.jpg",
                caption="Test caption",
                alt_text="Test alt text",
                sort_order=0,
                is_primary=True,
                is_active=True,
                hotel_id=real_hotel.id,
            )
            db.add(test_asset)
            db.commit()
            db.refresh(test_asset)
            check("MediaAsset row created with a real id", test_asset.id is not None)
            check("entity_id correctly stored (no FK, but value preserved)", test_asset.entity_id == real_hotel.id)

            # Cleanup
            db.delete(test_asset)
            db.commit()
            remaining = db.query(MediaAsset).filter(MediaAsset.entity_id == real_hotel.id).count()
            check("test row cleaned up successfully", remaining == 0)
        else:
            print("   SKIPPED - no Hotel row exists to test against.")

    finally:
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL MEDIA MIGRATION STRUCTURAL TESTS PASSED")


if __name__ == "__main__":
    run()