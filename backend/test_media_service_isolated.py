"""Phase 30a.2 — isolated verification of the media service layer:
authorization (SUPER_ADMIN unrestricted, MANAGER scoped, others blocked),
entity-existence validation, primary-image logic, and the resolution
precedence. Uses real HTTP calls through TestClient, matching the pattern
from test_security_hardening.py."""

from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.hotel import Hotel, RoomType
from app.models.restaurant import Restaurant
from app.core.security import create_access_token
from app.services import media_service
from app.schemas.media import MediaCreate
from app.models.media import MediaEntityType, MediaSourceType

client = TestClient(app)


def _token_for(user):
    return create_access_token(subject=str(user.id), role=user.role.value)


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

    created_media_ids = []

    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        manager = db.query(User).filter(User.role == RoleEnum.MANAGER).first()
        waiter = db.query(User).filter(User.role == RoleEnum.WAITER).first()
        real_hotel = db.query(Hotel).first()
        other_hotel = db.query(Hotel).filter(Hotel.id != real_hotel.id).first() if real_hotel else None

        if not admin or not real_hotel:
            print("   ABORT - missing admin/hotel.")
            return

        admin_headers = {"Authorization": f"Bearer {_token_for(admin)}"}

        print("1. SUPER_ADMIN can create media for any hotel...")
        response = client.post("/api/v1/media", json={
            "entity_type": "HOTEL", "entity_id": str(real_hotel.id),
            "url": "https://example.com/test-lobby.jpg", "caption": "Test Lobby", "is_primary": True,
        }, headers=admin_headers)
        check("201 created", response.status_code == 201)
        if response.status_code == 201:
            created_media_ids.append(response.json()["id"])
            check("is_primary is True", response.json()["is_primary"] is True)

        print("\n2. Creating a second primary for the same entity un-sets the first...")
        response2 = client.post("/api/v1/media", json={
            "entity_type": "HOTEL", "entity_id": str(real_hotel.id),
            "url": "https://example.com/test-exterior.jpg", "caption": "Test Exterior", "is_primary": True,
        }, headers=admin_headers)
        check("second creation succeeds", response2.status_code == 201)
        if response2.status_code == 201:
            created_media_ids.append(response2.json()["id"])
        list_response = client.get(f"/api/v1/media?entity_type=HOTEL&entity_id={real_hotel.id}", headers=admin_headers)
        primaries = [m for m in list_response.json() if m["is_primary"]]
        check("exactly one primary exists after the second create", len(primaries) == 1)

        if manager:
            manager_headers = {"Authorization": f"Bearer {_token_for(manager)}"}
            print("\n3. MANAGER can create media for their own hotel...")
            response3 = client.post("/api/v1/media", json={
                "entity_type": "HOTEL", "entity_id": str(manager.hotel_id),
                "url": "https://example.com/manager-test.jpg",
            }, headers=manager_headers)
            check("manager creates media for own hotel (201)", response3.status_code == 201)
            if response3.status_code == 201:
                created_media_ids.append(response3.json()["id"])

            if other_hotel:
                print("\n4. MANAGER cannot create media for a different hotel...")
                response4 = client.post("/api/v1/media", json={
                    "entity_type": "HOTEL", "entity_id": str(other_hotel.id),
                    "url": "https://example.com/should-fail.jpg",
                }, headers=manager_headers)
                check("cross-hotel media creation blocked (403)", response4.status_code == 403)
            else:
                print("\n4. SKIPPED - only one hotel exists.")
        else:
            print("\n3-4. SKIPPED - no MANAGER user found.")

        if waiter:
            waiter_headers = {"Authorization": f"Bearer {_token_for(waiter)}"}
            print("\n5. WAITER (non-management role) cannot create media...")
            response5 = client.post("/api/v1/media", json={
                "entity_type": "HOTEL", "entity_id": str(real_hotel.id),
                "url": "https://example.com/should-fail-2.jpg",
            }, headers=waiter_headers)
            check("waiter blocked from media creation (403)", response5.status_code == 403)

            print("\n6. WAITER (any authenticated user) CAN read media...")
            response6 = client.get(f"/api/v1/media?entity_type=HOTEL&entity_id={real_hotel.id}", headers=waiter_headers)
            check("waiter can read media (200)", response6.status_code == 200)
        else:
            print("\n5-6. SKIPPED - no WAITER user found.")

        print("\n7. Creating media for a nonexistent entity is rejected (404)...")
        import uuid as uuid_module
        response7 = client.post("/api/v1/media", json={
            "entity_type": "HOTEL", "entity_id": str(uuid_module.uuid4()),
            "url": "https://example.com/nonexistent.jpg",
        }, headers=admin_headers)
        check("nonexistent entity rejected (404)", response7.status_code == 404)

        print("\n8. resolve_primary_image_url precedence: MediaAsset primary wins over legacy fallback...")
        result = media_service.resolve_primary_image_url(db, MediaEntityType.HOTEL, real_hotel.id, legacy_fallback_url="https://legacy.example.com/fallback.jpg")
        check("returns the MediaAsset primary URL, not the legacy fallback", result == "https://example.com/test-exterior.jpg")

        print("\n9. resolve_primary_image_url falls back to legacy when no primary MediaAsset exists...")
        empty_entity_id = real_hotel.id  # reuse but filter a type with nothing
        result2 = media_service.resolve_primary_image_url(db, MediaEntityType.RESTAURANT, real_hotel.id, legacy_fallback_url="https://legacy.example.com/fallback.jpg")
        check("falls back to legacy URL when no MediaAsset primary exists for this scope", result2 == "https://legacy.example.com/fallback.jpg")

        print("\n10. Deactivating the primary image correctly clears its primary flag too...")
        if created_media_ids:
            deactivate_response = client.post(f"/api/v1/media/{created_media_ids[1]}/deactivate", headers=admin_headers)
            check("deactivate succeeds", deactivate_response.status_code == 200)
            check("deactivated asset is no longer primary", deactivate_response.json()["is_primary"] is False)

    finally:
        for mid in created_media_ids:
            db.execute(__import__("sqlalchemy").text("DELETE FROM media_assets WHERE id = :id"), {"id": mid})
        db.commit()
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL MEDIA SERVICE TESTS PASSED (test data cleaned up)")


if __name__ == "__main__":
    run()