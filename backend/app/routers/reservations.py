import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.restaurant import (
    TableReservationCreate, TableReservationResponse, ReservationStatusUpdate,
)
from app.services import reservation_service

router = APIRouter(prefix="/api/v1/reservations", tags=["Table Reservations"])


@router.post("", response_model=TableReservationResponse, status_code=201)
def create_reservation(
    data: TableReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reservation_service.create_reservation(db, current_user, data)


@router.get("/my", response_model=list[TableReservationResponse])
def my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reservation_service.list_my_reservations(db, current_user.id)


@router.get("/restaurant/{restaurant_id}", response_model=list[TableReservationResponse])
def reservations_for_restaurant(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return reservation_service.list_reservations_for_restaurant(db, current_user, restaurant_id)


@router.patch("/{reservation_id}/status", response_model=TableReservationResponse)
def update_reservation_status(
    reservation_id: uuid.UUID,
    data: ReservationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return reservation_service.update_reservation_status(db, current_user, reservation_id, data.status)


@router.post("/{reservation_id}/cancel", response_model=TableReservationResponse)
def cancel_reservation(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reservation_service.cancel_reservation(db, current_user, reservation_id)