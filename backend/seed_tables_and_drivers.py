"""Adds dining tables across a realistic spread of party sizes, and staffs
the delivery team.

Also repairs existing drivers: assign_driver() requires the driver's
restaurant_id to match the order's restaurant, so a driver created without
one can never be assigned — which is why deliveries sat unassigned.

Idempotent. Run from backend/:
    python seed_tables_and_drivers.py
"""
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.restaurant import Restaurant, RestaurantTable, TableStatus
from app.models.user import RoleEnum, User

# A hotel restaurant needs a spread: couples and solo diners fill the small
# tables, families the middle, and the large ones make private dining and
# group bookings possible — which also gives Alice a real range to book from.
TABLES = [
    ("T4", 2), ("T5", 2),
    ("T6", 4), ("T7", 4),
    ("T8", 6),
    ("T9", 10),
    ("T10", 15),
]

# Five drivers: enough that one being mid-delivery never blocks dispatch,
# few enough that the assignment dropdown stays readable.
DRIVERS = [
    ("rider.rahim@ihg.com", "Rahim", "Uddin", "01711000001"),
    ("rider.shanto@ihg.com", "Shanto", "Ahmed", "01711000002"),
    ("rider.nadia@ihg.com", "Nadia", "Haque", "01711000003"),
    ("rider.imran@ihg.com", "Imran", "Hossain", "01711000004"),
    ("rider.tasnim@ihg.com", "Tasnim", "Akter", "01711000005"),
]

DRIVER_PASSWORD = "DriverPass123"


def run():
    db = SessionLocal()
    try:
        restaurant = db.query(Restaurant).order_by(Restaurant.created_at).first()
        if not restaurant:
            raise RuntimeError("No restaurant found. Run seed_data.py first.")

        print(f"Restaurant: {restaurant.name}\n")

        # ---- Tables ---------------------------------------------------------
        created = 0
        for number, capacity in TABLES:
            existing = (
                db.query(RestaurantTable)
                .filter(RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.table_number == number)
                .first()
            )
            if existing:
                print(f"  - Table {number} already exists (seats {existing.capacity})")
                continue
            db.add(RestaurantTable(
                restaurant_id=restaurant.id,
                table_number=number,
                capacity=capacity,
                status=TableStatus.AVAILABLE,
            ))
            created += 1
            print(f"  + Table {number} — seats {capacity}")
        db.commit()

        all_tables = (
            db.query(RestaurantTable)
            .filter(RestaurantTable.restaurant_id == restaurant.id)
            .order_by(RestaurantTable.table_number)
            .all()
        )
        total_seats = sum(t.capacity for t in all_tables)
        print(f"\n  {created} table(s) added · {len(all_tables)} tables total · {total_seats} seats\n")

        # ---- Drivers --------------------------------------------------------
        added = 0
        for email, first, last, phone in DRIVERS:
            user = db.query(User).filter(User.email == email).first()
            if user:
                # Repair rather than skip — an unlinked driver is invisible to
                # the assignment dropdown.
                if user.restaurant_id != restaurant.id:
                    user.restaurant_id = restaurant.id
                    print(f"  ~ {first} {last} — linked to the restaurant")
                else:
                    print(f"  - {first} {last} already set up")
                user.is_active = True
                continue
            db.add(User(
                first_name=first,
                last_name=last,
                email=email,
                phone=phone,
                password_hash=hash_password(DRIVER_PASSWORD),
                role=RoleEnum.DELIVERY,
                restaurant_id=restaurant.id,
                is_active=True,
            ))
            added += 1
            print(f"  + {first} {last} ({email})")
        db.commit()

        # Any driver seeded earlier without a restaurant link can never be
        # assigned, so fix those too.
        orphans = (
            db.query(User)
            .filter(User.role == RoleEnum.DELIVERY, User.restaurant_id.is_(None))
            .all()
        )
        for driver in orphans:
            driver.restaurant_id = restaurant.id
            print(f"  ~ {driver.first_name} {driver.last_name} — was unlinked, now assignable")
        if orphans:
            db.commit()

        assignable = (
            db.query(User)
            .filter(User.role == RoleEnum.DELIVERY, User.restaurant_id == restaurant.id, User.is_active == True)  # noqa: E712
            .count()
        )
        print(f"\n  {added} driver(s) added · {assignable} assignable to {restaurant.name}")
        print(f"  Password for every seeded driver: {DRIVER_PASSWORD}\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()