import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.hotel import (
    BookingCreate, BookingResponse, BookingCheckoutCreate, BookingCheckoutResponse,
    HousekeepingTaskResponse, HousekeepingTaskUpdate,
)
from app.services import booking_service

router = APIRouter(prefix="/api/v1", tags=["Bookings & Housekeeping"])


@router.post("/bookings", response_model=BookingResponse, status_code=201)
def create_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return booking_service.create_booking(db, current_user, data)


@router.post("/bookings/checkout", response_model=BookingCheckoutResponse, status_code=201)
def checkout_booking(
    data: BookingCheckoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != RoleEnum.CUSTOMER:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only customer accounts can use hotel checkout.")
    return booking_service.create_booking_checkout(db, current_user, data)


@router.get("/bookings/my", response_model=list[BookingResponse])
def my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return booking_service.list_bookings(db, guest_id=current_user.id)


@router.get("/bookings", response_model=list[BookingResponse])
def all_bookings(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST)),
):
    return booking_service.list_bookings(db)


@router.post("/bookings/{booking_id}/check-in", response_model=BookingResponse)
def check_in(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.RECEPTIONIST, RoleEnum.MANAGER, RoleEnum.SUPER_ADMIN)),
):
    return booking_service.check_in_booking(db, booking_id, current_user)


@router.post("/bookings/{booking_id}/check-out", response_model=BookingResponse)
def check_out(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.RECEPTIONIST, RoleEnum.MANAGER, RoleEnum.SUPER_ADMIN)),
):
    return booking_service.check_out_booking(db, booking_id, current_user)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingResponse)
def cancel(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return booking_service.cancel_booking(db, booking_id, current_user)


@router.get("/housekeeping/tasks", response_model=list[HousekeepingTaskResponse])
def housekeeping_tasks(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.HOUSEKEEPING, RoleEnum.MANAGER, RoleEnum.SUPER_ADMIN)),
):
    return booking_service.list_housekeeping_tasks(db)


@router.patch("/housekeeping/tasks/{task_id}", response_model=HousekeepingTaskResponse)
def update_housekeeping_task(
    task_id: uuid.UUID,
    data: HousekeepingTaskUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.HOUSEKEEPING, RoleEnum.MANAGER, RoleEnum.SUPER_ADMIN)),
):
    return booking_service.update_housekeeping_task(db, task_id, data.status, data.notes)


@router.get("/bookings/my/active-stay")
def my_active_stay(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Is this guest currently in the hotel, and in which room?

    The delivery checkout uses this to offer "deliver to my room" — the point
    where the hotel and the delivery side of the platform actually meet."""
    from app.models.hotel import Booking, BookingStatus, Hotel, Room, RoomType

    booking = (
        db.query(Booking)
        .filter(Booking.guest_id == current_user.id, Booking.status == BookingStatus.CHECKED_IN)
        .order_by(Booking.check_in_date.desc())
        .first()
    )
    if not booking:
        return {"has_active_stay": False}

    room = db.query(Room).filter(Room.id == booking.room_id).first()
    room_type = db.query(RoomType).filter(RoomType.id == room.room_type_id).first() if room else None
    hotel = db.query(Hotel).filter(Hotel.id == room.hotel_id).first() if room else None

    return {
        "has_active_stay": True,
        "booking_reference": booking.booking_reference,
        "room_number": room.room_number if room else None,
        "room_type_name": room_type.name if room_type else None,
        "hotel_name": hotel.name if hotel else None,
        "hotel_address": hotel.address if hotel else None,
        "check_out_date": str(booking.check_out_date),
    }