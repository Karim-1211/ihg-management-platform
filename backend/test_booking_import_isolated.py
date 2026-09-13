"""Isolated verification of Phase 23.2 — booking import validation/preview
service. No database writes occur anywhere in this test; it only exercises
validate_columns/validate_row/build_preview against real lookups (hotel/
room/existing-booking-reference checks), which are read-only."""

from datetime import date, timedelta

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room, Booking
from app.services import booking_import_service as svc


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
        real_hotel = db.query(Hotel).first()
        real_room = db.query(Room).filter(Room.hotel_id == real_hotel.id).first() if real_hotel else None
        if not real_hotel or not real_room:
            print("   ABORT - no hotel/room found in database.")
            return

        print("1. Column validation catches missing required columns...")
        col_errors = svc.validate_columns(["guest_email", "hotel_name"])  # missing several required ones
        check("reports missing columns", len(col_errors) > 0)

        col_errors_ok = svc.validate_columns(list(svc.REQUIRED_COLUMNS))
        check("no errors when all required columns present", len(col_errors_ok) == 0)

        print("\n2. A fully valid row passes with no errors...")
        valid_row = {
            "guest_email": "test.import.valid@example.com", "guest_first_name": "Test", "guest_last_name": "Valid",
            "hotel_name": real_hotel.name, "room_number": real_room.room_number,
            "check_in_date": "2025-01-01", "check_out_date": "2025-01-03",
            "number_of_guests": "2", "total_amount": "200.00", "status": "CHECKED_OUT",
        }
        result = svc.validate_row(db, 1, valid_row, set())
        check("no errors", not result.has_errors)
        check("will_import is True", result.will_import)
        check("normalized data present", result.normalized is not None)

        print("\n3. Invalid date is rejected with a clear error...")
        bad_date_row = dict(valid_row, check_in_date="not-a-date")
        result = svc.validate_row(db, 2, bad_date_row, set())
        check("has error", result.has_errors)
        check("will_import is False", not result.will_import)

        print("\n4. check_out before check_in is rejected...")
        reversed_row = dict(valid_row, check_in_date="2025-01-05", check_out_date="2025-01-01")
        result = svc.validate_row(db, 3, reversed_row, set())
        check("has error for reversed dates", result.has_errors)

        print("\n5. Negative amount is rejected...")
        negative_row = dict(valid_row, total_amount="-50.00")
        result = svc.validate_row(db, 4, negative_row, set())
        check("has error for negative amount", result.has_errors)

        print("\n6. Unknown hotel is rejected...")
        bad_hotel_row = dict(valid_row, hotel_name="Nonexistent Hotel XYZ")
        result = svc.validate_row(db, 5, bad_hotel_row, set())
        check("has error for unknown hotel", result.has_errors)

        print("\n7. Duplicate booking_reference within the same file is caught...")
        ref_row_1 = dict(valid_row, booking_reference="DUPTEST123")
        ref_row_2 = dict(valid_row, booking_reference="DUPTEST123")
        seen = set()
        r1 = svc.validate_row(db, 6, ref_row_1, seen)
        r2 = svc.validate_row(db, 7, ref_row_2, seen)
        check("first occurrence has no error", not r1.has_errors)
        check("second (duplicate) occurrence has an error", r2.has_errors)

        print("\n8. Existing booking_reference in the database is caught...")
        existing_booking = db.query(Booking).first()
        if existing_booking:
            dup_db_row = dict(valid_row, booking_reference=existing_booking.booking_reference)
            result = svc.validate_row(db, 8, dup_db_row, set())
            check("has error for DB-existing reference", result.has_errors)
        else:
            print("   SKIPPED - no existing booking to test against.")

        print("\n9. Overlapping room dates produce a WARNING, not an ERROR (row still imports)...")
        existing_room_booking = (
            db.query(Booking).filter(Booking.room_id == real_room.id).first()
        )
        if existing_room_booking:
            overlap_row = dict(
                valid_row,
                check_in_date=str(existing_room_booking.check_in_date),
                check_out_date=str(existing_room_booking.check_in_date + timedelta(days=1)),
            )
            result = svc.validate_row(db, 9, overlap_row, set())
            check("has a WARNING for overlap", result.has_warnings)
            check("does NOT have an ERROR from the overlap itself", result.will_import or result.has_errors is False or any(i.field != "room_number" for i in result.issues if i.level == "ERROR"))
        else:
            print("   SKIPPED - no existing booking on this room to create a genuine overlap against.")

        print("\n10. Missing guest name still allows lookup-by-email but blocks creation if truly new...")
        no_name_row = dict(valid_row, guest_first_name="", guest_last_name="", guest_email="brand.new.no.name@example.com")
        result = svc.validate_row(db, 10, no_name_row, set())
        check("has errors for missing names", result.has_errors)

        print("\n11. build_preview aggregates correctly across a small batch...")
        rows = [valid_row, bad_date_row, dict(valid_row, guest_email="another.valid@example.com")]
        preview = svc.build_preview(db, rows, list(svc.REQUIRED_COLUMNS) + list(svc.OPTIONAL_COLUMNS))
        check("total_rows matches input", preview.total_rows == 3)
        check("at least 1 valid row", preview.valid_rows >= 1)
        check("at least 1 error row", preview.error_rows >= 1)

    finally:
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL BOOKING IMPORT VALIDATION TESTS PASSED")


if __name__ == "__main__":
    run()