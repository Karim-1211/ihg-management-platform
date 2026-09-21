import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum
from app.schemas.hotel import (
    HotelCreate, HotelResponse, RoomTypeCreate, RoomTypeResponse,
    RoomCreate, RoomResponse, RoomStatusUpdate,
)
from app.services import hotel_service, booking_service, media_service
from app.models.media import MediaEntityType

router = APIRouter(prefix="/api/v1", tags=["Hotels"])


def _attach_hotel_image(db: Session, hotel):
    hotel.primary_image_url = media_service.resolve_primary_image_url(db, MediaEntityType.HOTEL, hotel.id)
    return hotel


def _attach_room_type_image(db: Session, room_type):
    room_type.primary_image_url = media_service.resolve_primary_image_url(db, MediaEntityType.ROOM_TYPE, room_type.id)
    return room_type


@router.post("/hotels", response_model=HotelResponse, status_code=201)
def create_hotel(
    data: HotelCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    return hotel_service.create_hotel(db, data)


@router.get("/hotels", response_model=list[HotelResponse])
def list_hotels(db: Session = Depends(get_db)):
    hotels = hotel_service.list_hotels(db)
    return [_attach_hotel_image(db, h) for h in hotels]


@router.post("/room-types", response_model=RoomTypeResponse, status_code=201)
def create_room_type(
    data: RoomTypeCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return hotel_service.create_room_type(db, data)


@router.get("/hotels/{hotel_id}/room-types", response_model=list[RoomTypeResponse])
def list_room_types(hotel_id: uuid.UUID, db: Session = Depends(get_db)):
    room_types = hotel_service.list_room_types(db, hotel_id)
    return [_attach_room_type_image(db, rt) for rt in room_types]


@router.post("/rooms", response_model=RoomResponse, status_code=201)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return hotel_service.create_room(db, data)


@router.get("/rooms", response_model=list[RoomResponse])
def list_rooms(hotel_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    return hotel_service.list_rooms(db, hotel_id)


@router.get("/rooms/available", response_model=list[RoomResponse])
def list_available_rooms(
    check_in_date: date = Query(...),
    check_out_date: date = Query(...),
    hotel_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
):
    return booking_service.list_available_rooms(db, check_in_date, check_out_date, hotel_id)


@router.patch("/rooms/{room_id}/status", response_model=RoomResponse)
def update_room_status(
    room_id: uuid.UUID,
    data: RoomStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.HOUSEKEEPING, RoleEnum.RECEPTIONIST)),
):
    return hotel_service.update_room_status(db, room_id, data.status)