"""Isolated verification of Phase 18.7A booking-restriction rules (minimum/
maximum stay, maximum advance booking, cancellation deadline). Run directly
with python. Self-adapting: uses real hotel/room data from the database.
Temporarily tightens rules to prove enforcement, then restores the seeded
defaults so regression scripts are unaffected."""

from datetime import date, timedelta
from decimal import Decimal

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, RuleStatus
from app.models.hotel import Room, RoomStatus, Booking
from app.models.user import User, RoleEnum
from app.schemas.hotel import BookingCreate
from app.services import booking_service
from fastapi import HTTPException


def get_rule(db, rule_key):
    return db.query(BusinessRule).filter(BusinessRule.rule_key == rule_key, BusinessRule.status == RuleStatus.ACTIVE).first()


def run():
    db = SessionLocal()
    passed = 0
    failed = 0
    created_booking_ids = []

    def check(label, condition):
        nonlocal passed, failed
        if condition:
            print(f"   OK - {label}")
            passed += 1
        else:
            print(f"   FAILED - {label}")
            failed += 1

    # Snapshot original values so we can restore them exactly.
    originals = {}

    try:
        print("0. Loading real customer and an available room...")
        customer = db.query(User).filter(User.role == RoleEnum.CUSTOMER).first()
        room = db.query(Room).filter(Room.status.notin_([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE])).first()
        if not customer or not room:
            print("   ABORT - no customer or room found in database.")
            return
        print(f"   customer: {customer.email}, room: {room.room_number}")

        for key in ["HOTEL_MINIMUM_STAY_NIGHTS", "HOTEL_MAXIMUM_STAY_NIGHTS", "HOTEL_MAXIMUM_ADVANCE_BOOKING_DAYS", "HOTEL_CANCELLATION_DEADLINE_HOURS"]:
            rule = get_rule(db, key)
            if rule:
                originals[key] = rule.numeric_value

        print("\n1. Tighten HOTEL_MINIMUM_STAY_NIGHTS to 3, confirm a 1-night booking is rejected...")
        min_rule = get_rule(db, "HOTEL_MINIMUM_STAY_NIGHTS")
        min_rule.numeric_value = Decimal("3")
        db.commit()
        try:
            booking_service.create_booking(db, customer, BookingCreate(
                room_id=room.id, check_in_date=date.today() + timedelta(days=10),
                check_out_date=date.today() + timedelta(days=11), number_of_guests=1,
            ))
            check("1-night booking blocked by min-stay=3 (should have raised 422)", False)
        except HTTPException as e:
            check("1-night booking blocked by min-stay=3 (422 raised)", e.status_code == 422)
        min_rule.numeric_value = originals["HOTEL_MINIMUM_STAY_NIGHTS"]
        db.commit()

        print("\n2. Tighten HOTEL_MAXIMUM_STAY_NIGHTS to 2, confirm a 5-night booking is rejected...")
        max_rule = get_rule(db, "HOTEL_MAXIMUM_STAY_NIGHTS")
        max_rule.numeric_value = Decimal("2")
        db.commit()
        try:
            booking_service.create_booking(db, customer, BookingCreate(
                room_id=room.id, check_in_date=date.today() + timedelta(days=20),
                check_out_date=date.today() + timedelta(days=25), number_of_guests=1,
            ))
            check("5-night booking blocked by max-stay=2 (should have raised 422)", False)
        except HTTPException as e:
            check("5-night booking blocked by max-stay=2 (422 raised)", e.status_code == 422)
        max_rule.numeric_value = originals["HOTEL_MAXIMUM_STAY_NIGHTS"]
        db.commit()

        print("\n3. Tighten HOTEL_MAXIMUM_ADVANCE_BOOKING_DAYS to 5, confirm a 30-day-out booking is rejected...")
        adv_rule = get_rule(db, "HOTEL_MAXIMUM_ADVANCE_BOOKING_DAYS")
        adv_rule.numeric_value = Decimal("5")
        db.commit()
        try:
            booking_service.create_booking(db, customer, BookingCreate(
                room_id=room.id, check_in_date=date.today() + timedelta(days=30),
                check_out_date=date.today() + timedelta(days=31), number_of_guests=1,
            ))
            check("30-day-advance booking blocked by max-advance=5 (should have raised 422)", False)
        except HTTPException as e:
            check("30-day-advance booking blocked by max-advance=5 (422 raised)", e.status_code == 422)
        adv_rule.numeric_value = originals["HOTEL_MAXIMUM_ADVANCE_BOOKING_DAYS"]
        db.commit()

        print("\n4. Confirm a normal, policy-compliant booking still succeeds with defaults restored...")
        booking = booking_service.create_booking(db, customer, BookingCreate(
            room_id=room.id, check_in_date=date.today() + timedelta(days=40),
            check_out_date=date.today() + timedelta(days=42), number_of_guests=1,
        ))
        created_booking_ids.append(booking.id)
        check("normal booking succeeds with restored defaults", booking.status.value == "CONFIRMED")

        print("\n5. Tighten HOTEL_CANCELLATION_DEADLINE_HOURS to 999999, confirm cancellation is now blocked...")
        deadline_rule = get_rule(db, "HOTEL_CANCELLATION_DEADLINE_HOURS")
        deadline_rule.numeric_value = Decimal("999999")
        db.commit()
        try:
            booking_service.cancel_booking(db, booking.id, customer)
            check("cancellation blocked by tight deadline (should have raised 409)", False)
        except HTTPException as e:
            check("cancellation blocked by tight deadline (409 raised)", e.status_code == 409)
        deadline_rule.numeric_value = originals["HOTEL_CANCELLATION_DEADLINE_HOURS"]
        db.commit()

        print("\n6. With deadline restored to 0 (no deadline), cancellation now succeeds...")
        cancelled = booking_service.cancel_booking(db, booking.id, customer)
        check("cancellation succeeds with deadline=0", cancelled.status.value == "CANCELLED")

    finally:
        # Restore every original value defensively, even if an assertion failed mid-way.
        for key, val in originals.items():
            rule = get_rule(db, key)
            if rule and rule.numeric_value != val:
                rule.numeric_value = val
        db.commit()
        for bid in created_booking_ids:
            b = db.query(Booking).filter(Booking.id == bid).first()
            if b:
                db.delete(b)
        db.commit()
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL CATEGORY B BOOKING RULE TESTS PASSED")


if __name__ == "__main__":
    run()