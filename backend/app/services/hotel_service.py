import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.hotel import Hotel, RoomType, Room, RoomStatus
from app.models.user import User, RoleEnum
from app.schemas.hotel import HotelCreate, RoomTypeCreate, RoomCreate


def create_hotel(db: Session, data: HotelCreate) -> Hotel:
    hotel = Hotel(**data.model_dump())
    db.add(hotel)
    db.commit()
    db.refresh(hotel)
    return hotel


def list_hotels(db: Session) -> list[Hotel]:
    return db.query(Hotel).filter(Hotel.is_active == True).all()  # noqa: E712


def get_hotel_or_404(db: Session, hotel_id: uuid.UUID) -> Hotel:
    hotel = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found.")
    return hotel


def assert_hotel_access(db: Session, current_user: User, hotel_id: uuid.UUID) -> Hotel:
    """Phase 30a.2 — central tenant-boundary check for hotel-scoped write
    operations (media management, and any future hotel-scoped write),
    mirroring the exact pattern already proven in
    restaurant_service.assert_restaurant_access."""
    hotel = get_hotel_or_404(db, hotel_id)

    if current_user.role == RoleEnum.SUPER_ADMIN:
        return hotel

    if current_user.role == RoleEnum.MANAGER:
        if current_user.hotel_id != hotel.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not manage this hotel.",
            )
        return hotel

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this hotel.")


def create_room_type(db: Session, data: RoomTypeCreate) -> RoomType:
    get_hotel_or_404(db, data.hotel_id)
    room_type = RoomType(**data.model_dump())
    db.add(room_type)
    db.commit()
    db.refresh(room_type)
    return room_type


def list_room_types(db: Session, hotel_id: uuid.UUID) -> list[RoomType]:
    return db.query(RoomType).filter(RoomType.hotel_id == hotel_id).all()


def create_room(db: Session, data: RoomCreate) -> Room:
    get_hotel_or_404(db, data.hotel_id)
    room_type = db.query(RoomType).filter(RoomType.id == data.room_type_id).first()
    if not room_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room type not found.")

    existing = (
        db.query(Room)
        .filter(Room.hotel_id == data.hotel_id, Room.room_number == data.room_number)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A room with this number already exists at this hotel.",
        )

    room = Room(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def list_rooms(db: Session, hotel_id: uuid.UUID | None = None) -> list[Room]:
    query = db.query(Room)
    if hotel_id:
        query = query.filter(Room.hotel_id == hotel_id)
    return query.all()


def get_room_or_404(db: Session, room_id: uuid.UUID) -> Room:
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")
    return room


def update_room_status(db: Session, room_id: uuid.UUID, new_status: RoomStatus) -> Room:
    room = get_room_or_404(db, room_id)
    room.status = new_status
    db.commit()
    db.refresh(room)
    return room