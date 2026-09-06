"""
Seed script — creates baseline demo data for local development.
Safe to run multiple times: checks for existing records before creating new ones.

Usage (from backend/, with venv active):
    python seed_data.py
"""

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, RoleEnum
from app.models.hotel import Hotel, RoomType, Room, RoomStatus


def get_or_create_hotel(db, name, **kwargs):
    hotel = db.query(Hotel).filter(Hotel.name == name).first()
    if hotel:
        print(f"  - Hotel '{name}' already exists, skipping.")
        return hotel
    hotel = Hotel(name=name, **kwargs)
    db.add(hotel)
    db.commit()
    db.refresh(hotel)
    print(f"  + Created hotel '{name}'")
    return hotel


def get_or_create_room_type(db, hotel_id, name, **kwargs):
    room_type = db.query(RoomType).filter(RoomType.hotel_id == hotel_id, RoomType.name == name).first()
    if room_type:
        print(f"  - Room type '{name}' already exists, skipping.")
        return room_type
    room_type = RoomType(hotel_id=hotel_id, name=name, **kwargs)
    db.add(room_type)
    db.commit()
    db.refresh(room_type)
    print(f"  + Created room type '{name}'")
    return room_type


def get_or_create_room(db, hotel_id, room_type_id, room_number, **kwargs):
    room = db.query(Room).filter(Room.hotel_id == hotel_id, Room.room_number == room_number).first()
    if room:
        print(f"  - Room '{room_number}' already exists, skipping.")
        return room
    room = Room(hotel_id=hotel_id, room_type_id=room_type_id, room_number=room_number, **kwargs)
    db.add(room)
    db.commit()
    db.refresh(room)
    print(f"  + Created room '{room_number}'")
    return room


def get_or_create_user(db, email, **kwargs):
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"  - User '{email}' already exists, skipping.")
        return user
    password = kwargs.pop("password")
    user = User(email=email, password_hash=hash_password(password), **kwargs)
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  + Created user '{email}' (role: {kwargs.get('role').value})")
    return user


def run_seed():
    db = SessionLocal()
    try:
        print("Seeding hotel...")
        hotel = get_or_create_hotel(
            db, "IHG Grand Dhaka",
            description="Flagship demo property", address="123 Gulshan Avenue",
            city="Dhaka", country="Bangladesh", phone="01700000000", email="grand.dhaka@ihg.com",
        )

        print("\nSeeding room types...")
        deluxe = get_or_create_room_type(
            db, hotel.id, "Deluxe Suite",
            description="Spacious suite with city view", base_price=150, max_occupancy=2,
        )
        standard = get_or_create_room_type(
            db, hotel.id, "Standard Room",
            description="Comfortable standard room", base_price=80, max_occupancy=2,
        )

        print("\nSeeding rooms...")
        get_or_create_room(db, hotel.id, deluxe.id, "204", floor=2, status=RoomStatus.READY)
        get_or_create_room(db, hotel.id, deluxe.id, "305", floor=3, status=RoomStatus.READY)
        get_or_create_room(db, hotel.id, standard.id, "101", floor=1, status=RoomStatus.READY)
        get_or_create_room(db, hotel.id, standard.id, "102", floor=1, status=RoomStatus.READY)

        print("\nSeeding staff accounts...")
        get_or_create_user(
            db, "admin@ihg.com", first_name="Super", last_name="Admin",
            password="AdminPass123", role=RoleEnum.SUPER_ADMIN,
        )
        get_or_create_user(
            db, "manager@ihg.com", first_name="Maya", last_name="Manager",
            password="ManagerPass123", role=RoleEnum.MANAGER, hotel_id=hotel.id,
        )
        get_or_create_user(
            db, "reception@ihg.com", first_name="Rina", last_name="Reception",
            password="ReceptionPass123", role=RoleEnum.RECEPTIONIST, hotel_id=hotel.id,
        )
        get_or_create_user(
            db, "housekeeping@ihg.com", first_name="Hana", last_name="Housekeeping",
            password="HousePass123", role=RoleEnum.HOUSEKEEPING, hotel_id=hotel.id,
        )

        print("\nSeeding a demo customer...")
        get_or_create_user(
            db, "guest@ihg.com", first_name="Demo", last_name="Guest",
            password="GuestPass123", role=RoleEnum.CUSTOMER,
        )

        print("\nSeed complete.")
        print("\nDemo login credentials:")
        print("  SUPER_ADMIN:  admin@ihg.com / AdminPass123")
        print("  MANAGER:      manager@ihg.com / ManagerPass123")
        print("  RECEPTIONIST: reception@ihg.com / ReceptionPass123")
        print("  HOUSEKEEPING: housekeeping@ihg.com / HousePass123")
        print("  CUSTOMER:     guest@ihg.com / GuestPass123")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()