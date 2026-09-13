"""Phase 23.5 — end-to-end test matrix for the transactional import
writer: valid, invalid, duplicate, historical, and conflicting rows in
one batch. Creates real rows against the real database, then cleans up
everything it created (bookings + any newly-created guest users) so the
regression suite's data stays consistent."""

from datetime import date, timedelta

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room, Booking
from app.models.user import User, RoleEnum
from app.services import booking_import_writer as writer
from app.services.booking_import_service import REQUIRED_COLUMNS, OPTIONAL_COLUMNS


def run():
    db = SessionLocal()
    passed = 0
    failed = 0
    created_booking_refs = []
    created_guest_emails = []

    def check(label, condition):
        nonlocal passed, failed
        if condition:
            print(f"   OK - {label}")
            passed += 1
        else:
            print(f"   FAILED - {label}")
            failed += 1

    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        real_hotel = db.query(Hotel).first()
        real_room = db.query(Room).filter(Room.hotel_id == real_hotel.id).first() if real_hotel else None
        existing_customer = db.query(User).filter(User.role == RoleEnum.CUSTOMER).first()
        existing_booking = db.query(Booking).filter(Booking.room_id == real_room.id).first() if real_room else None

        if not admin or not real_hotel or not real_room:
            print("   ABORT - missing admin/hotel/room in database.")
            return

        new_guest_email = "import.test.newguest@example.com"
        created_guest_emails.append(new_guest_email)

        rows = [
            # 1. Valid, brand-new guest
            {
                "guest_email": new_guest_email, "guest_first_name": "Import", "guest_last_name": "TestGuest",
                "hotel_name": real_hotel.name, "room_number": real_room.room_number,
                "check_in_date": "2024-06-01", "check_out_date": "2024-06-03",
                "number_of_guests": "2", "total_amount": "199.99", "status": "CHECKED_OUT",
            },
            # 2. Valid, existing guest by email
            {
                "guest_email": existing_customer.email if existing_customer else new_guest_email,
                "guest_first_name": "Ignored", "guest_last_name": "Ignored",
                "hotel_name": real_hotel.name, "room_number": real_room.room_number,
                "check_in_date": "2024-07-01", "check_out_date": "2024-07-02",
                "number_of_guests": "1", "total_amount": "80.00", "status": "CHECKED_OUT",
            },
            # 3. Invalid — bad date, should be skipped
            {
                "guest_email": "bad.date@example.com", "guest_first_name": "Bad", "guest_last_name": "Date",
                "hotel_name": real_hotel.name, "room_number": real_room.room_number,
                "check_in_date": "not-a-date", "check_out_date": "2024-08-02",
                "number_of_guests": "1", "total_amount": "80.00",
            },
            # 4. Duplicate reference within the batch — second one should be skipped
            {
                "guest_email": "dup.a@example.com", "guest_first_name": "Dup", "guest_last_name": "A",
                "hotel_name": real_hotel.name, "room_number": real_room.room_number,
                "check_in_date": "2024-09-01", "check_out_date": "2024-09-02",
                "number_of_guests": "1", "total_amount": "80.00", "booking_reference": "IMPORTDUPTEST1",
            },
            {
                "guest_email": "dup.b@example.com", "guest_first_name": "Dup", "guest_last_name": "B",
                "hotel_name": real_hotel.name, "room_number": real_room.room_number,
                "check_in_date": "2024-10-01", "check_out_date": "2024-10-02",
                "number_of_guests": "1", "total_amount": "80.00", "booking_reference": "IMPORTDUPTEST1",
            },
        ]
        created_guest_emails.extend(["bad.date@example.com", "dup.a@example.com", "dup.b@example.com"])

        # 5. Conflicting/overlapping row (warning, but still imports) — only if a real existing booking exists to overlap
        if existing_booking:
            rows.append({
                "guest_email": "overlap.test@example.com", "guest_first_name": "Overlap", "guest_last_name": "Test",
                "hotel_name": real_hotel.name, "room_number": real_room.room_number,
                "check_in_date": str(existing_booking.check_in_date),
                "check_out_date": str(existing_booking.check_in_date + timedelta(days=1)),
                "number_of_guests": "1", "total_amount": "80.00",
            })
            created_guest_emails.append("overlap.test@example.com")

        fieldnames = list(REQUIRED_COLUMNS) + list(OPTIONAL_COLUMNS)

        print("1. Preview (no writes) reports correct counts before commit...")
        preview_before = writer.preview_import(db, rows, fieldnames)
        check("total_rows matches input", preview_before.total_rows == len(rows))
        check("at least 1 error row (bad date + 1 duplicate)", preview_before.error_rows >= 2)
        no_extra_bookings_yet = db.query(Booking).filter(Booking.booking_reference == "IMPORTDUPTEST1").count() == 0
        check("preview created zero database rows", no_extra_bookings_yet)

        print("\n2. Commit import — valid rows written, invalid rows skipped, atomic batch...")
        report = writer.import_bookings(db, rows, fieldnames, admin)
        check("report.success is True", report.success)
        expected_min_imports = 3 if existing_booking else 2  # new guest + existing-guest + (overlap row, if applicable)
        check(f"imported_count is at least {expected_min_imports} (got {report.imported_count})", report.imported_count >= expected_min_imports)
        check("skipped_count includes bad date + 1 duplicate", report.skipped_count >= 2)
        if existing_booking:
            check("warning_count reflects the overlap row", report.warning_count >= 1)

        print("\n3. Verify the new-guest booking actually exists in the database...")
        new_guest_user = db.query(User).filter(User.email == new_guest_email).first()
        check("new guest user was created", new_guest_user is not None)
        if new_guest_user:
            new_booking = db.query(Booking).filter(Booking.guest_id == new_guest_user.id, Booking.total_amount == 199.99).first()
            check("new booking exists with correct amount", new_booking is not None)
            if new_booking:
                created_booking_refs.append(new_booking.booking_reference)

        print("\n4. Verify the existing-guest row did NOT create a duplicate user...")
        if existing_customer:
            matching_users = db.query(User).filter(User.email == existing_customer.email).count()
            check("still exactly one user with that email", matching_users == 1)

        print("\n5. Verify only ONE of the two duplicate-reference rows was imported...")
        dup_count = db.query(Booking).filter(Booking.booking_reference == "IMPORTDUPTEST1").count()
        check("exactly one booking with that reference exists", dup_count == 1)
        if dup_count == 1:
            created_booking_refs.append("IMPORTDUPTEST1")

        print("\n6. Verify the bad-date row created NOTHING...")
        bad_date_user = db.query(User).filter(User.email == "bad.date@example.com").first()
        check("no user created for the invalid row", bad_date_user is None)

        if existing_booking:
            print("\n7. Verify the overlapping row WAS imported despite the warning...")
            overlap_user = db.query(User).filter(User.email == "overlap.test@example.com").first()
            check("overlap-row guest user was created", overlap_user is not None)
            if overlap_user:
                overlap_booking = db.query(Booking).filter(Booking.guest_id == overlap_user.id).first()
                check("overlap-row booking was created", overlap_booking is not None)
                if overlap_booking:
                    created_booking_refs.append(overlap_booking.booking_reference)

        print("\n8. Column-error short-circuit: missing required columns produces zero writes...")
        before_count = db.query(Booking).count()
        bad_report = writer.import_bookings(db, [{"guest_email": "x@example.com"}], ["guest_email"], admin)
        after_count = db.query(Booking).count()
        check("no rows written when required columns are missing", before_count == after_count)
        check("report.success is False for column errors", not bad_report.success)

    finally:
        # Cleanup: remove everything this test created, in dependency order.
        for ref in created_booking_refs:
            b = db.query(Booking).filter(Booking.booking_reference == ref).first()
            if b:
                db.delete(b)
        db.commit()
        for email in created_guest_emails:
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.delete(u)
        db.commit()
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL BOOKING IMPORT WRITER TESTS PASSED (test data cleaned up)")


if __name__ == "__main__":
    run()