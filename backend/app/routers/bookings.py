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