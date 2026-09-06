import uuid
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User, RoleEnum
from app.models.hotel import Hotel, RoomType, Room, RoomStatus
from app.core.security import hash_password
from app.services import booking_service
from app.schemas.hotel import BookingCreate

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture
def db_session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def sample_room_and_guest(db_session):
    hotel = Hotel(name="Test Hotel")
    db_session.add(hotel)
    db_session.commit()
    db_session.refresh(hotel)

    room_type = RoomType(hotel_id=hotel.id, name="Standard", base_price=1000, max_occupancy=2)
    db_session.add(room_type)
    db_session.commit()
    db_session.refresh(room_type)

    room = Room(hotel_id=hotel.id, room_type_id=room_type.id, room_number="101", status=RoomStatus.READY)
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    guest = User(
        first_name="Test", last_name="Guest", email="guest@test.com",
        password_hash=hash_password("password123"), role=RoleEnum.CUSTOMER,
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)

    return room, guest


def test_booking_succeeds_for_available_room(db_session, sample_room_and_guest):
    room, guest = sample_room_and_guest
    data = BookingCreate(
        room_id=room.id, check_in_date=date(2026, 10, 1), check_out_date=date(2026, 10, 3),
        number_of_guests=1,
    )
    booking = booking_service.create_booking(db_session, guest, data)
    assert booking.status.value == "CONFIRMED"
    assert float(booking.total_amount) == 2000.0


def test_overlapping_booking_is_rejected(db_session, sample_room_and_guest):
    room, guest = sample_room_and_guest
    first = BookingCreate(
        room_id=room.id, check_in_date=date(2026, 10, 1), check_out_date=date(2026, 10, 5),
        number_of_guests=1,
    )
    booking_service.create_booking(db_session, guest, first)

    overlapping = BookingCreate(
        room_id=room.id, check_in_date=date(2026, 10, 3), check_out_date=date(2026, 10, 6),
        number_of_guests=1,
    )
    with pytest.raises(Exception) as exc_info:
        booking_service.create_booking(db_session, guest, overlapping)
    assert "already booked" in str(exc_info.value.detail)


def test_non_overlapping_booking_succeeds(db_session, sample_room_and_guest):
    room, guest = sample_room_and_guest
    first = BookingCreate(
        room_id=room.id, check_in_date=date(2026, 10, 1), check_out_date=date(2026, 10, 3),
        number_of_guests=1,
    )
    booking_service.create_booking(db_session, guest, first)

    second = BookingCreate(
        room_id=room.id, check_in_date=date(2026, 10, 3), check_out_date=date(2026, 10, 5),
        number_of_guests=1,
    )
    booking = booking_service.create_booking(db_session, guest, second)
    assert booking.status.value == "CONFIRMED"