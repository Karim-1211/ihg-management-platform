"""One-off cleanup script: removes the placeholder "Some Other Hotel" seed
entry. Safe to re-run. If it has any rooms, room types, bookings, or
restaurants attached, it's deactivated (is_active=False) instead of
deleted, and the attached counts are printed so you can decide whether to
remove those too.

Run from backend/:
    python remove_placeholder_hotel.py
"""
from app.core.database import SessionLocal
from app.models.hotel import Hotel, Room, RoomType, Booking
from app.models.media import MediaAsset
from app.models.restaurant import Restaurant

PLACEHOLDER_NAME = "Some Other Hotel"


def run():
    db = SessionLocal()
    try:
        print("Hotels currently in the database:")
        for h in db.query(Hotel).all():
            print(f"  - {h.name!r} (id={h.id}, is_active={h.is_active})")

        hotel = db.query(Hotel).filter(Hotel.name == PLACEHOLDER_NAME).first()
        if not hotel:
            print(f'\nNo hotel named "{PLACEHOLDER_NAME}" was found — nothing to remove.')
            return

        room_types = db.query(RoomType).filter(RoomType.hotel_id == hotel.id).all()
        rooms = db.query(Room).filter(Room.hotel_id == hotel.id).all()
        room_ids = [r.id for r in rooms]
        bookings = db.query(Booking).filter(Booking.room_id.in_(room_ids)).all() if room_ids else []
        restaurants = db.query(Restaurant).filter(Restaurant.hotel_id == hotel.id).all()

        if room_types or rooms or bookings or restaurants:
            hotel.is_active = False
            db.commit()
            print(
                f'\n"{PLACEHOLDER_NAME}" has attached data '
                f"({len(room_types)} room type(s), {len(rooms)} room(s), {len(bookings)} booking(s), "
                f"{len(restaurants)} restaurant(s)), so it was deactivated (is_active=False) rather than deleted. "
                "It will now be excluded from list_hotels() and should no longer appear on the /hotels page."
            )
            return

        db.query(MediaAsset).filter(MediaAsset.hotel_id == hotel.id).delete(synchronize_session=False)
        db.delete(hotel)
        db.commit()
        print(f'\nDeleted placeholder hotel "{PLACEHOLDER_NAME}" (no rooms, room types, bookings, or restaurants were attached).')
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()