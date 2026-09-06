import uuid
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.restaurant import (
    RestaurantTable, TableReservation, ReservationStatus, Restaurant,
)
from app.models.user import User
from app.schemas.restaurant import TableReservationCreate
from app.services.restaurant_service import assert_restaurant_access, get_table_or_404


def has_overlapping_reservation(
    db: Session,
    table_id: uuid.UUID,
    reservation_start,
    reservation_end,
    exclude_reservation_id: uuid.UUID | None = None,
) -> bool:
    query = db.query(TableReservation).filter(
        TableReservation.table_id == table_id,
        TableReservation.status.in_([ReservationStatus.CONFIRMED, ReservationStatus.SEATED]),
        TableReservation.reservation_start < reservation_end,
        TableReservation.reservation_end > reservation_start,
    )
    if exclude_reservation_id:
        query = query.filter(TableReservation.id != exclude_reservation_id)
    return db.query(query.exists()).scalar()


def create_reservation(db: Session, customer: User, data: TableReservationCreate) -> TableReservation:
    table = get_table_or_404(db, data.table_id)

    reservation_end = data.reservation_end
    if reservation_end is None:
        reservation_end = data.reservation_start + timedelta(minutes=settings.default_reservation_minutes)

    if reservation_end <= data.reservation_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reservation end time must be after the start time.",
        )

    if data.party_size > table.capacity:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"This table seats up to {table.capacity} guests.",
        )

    if has_overlapping_reservation(db, table.id, data.reservation_start, reservation_end):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This table is already reserved for the selected time.",
        )

    reservation = TableReservation(
        table_id=table.id,
        customer_id=customer.id,
        reservation_start=data.reservation_start,
        reservation_end=reservation_end,
        party_size=data.party_size,
        status=ReservationStatus.CONFIRMED,
        notes=data.notes,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return _attach_display_fields(db, reservation)


def _attach_display_fields(db: Session, reservation: TableReservation) -> TableReservation:
    table = db.query(RestaurantTable).filter(RestaurantTable.id == reservation.table_id).first()
    if table:
        reservation.table_number = table.table_number
        restaurant = db.query(Restaurant).filter(Restaurant.id == table.restaurant_id).first()
        if restaurant:
            reservation.restaurant_name = restaurant.name
    return reservation


def list_my_reservations(db: Session, customer_id: uuid.UUID) -> list[TableReservation]:
    reservations = (
        db.query(TableReservation)
        .filter(TableReservation.customer_id == customer_id)
        .order_by(TableReservation.reservation_start.desc())
        .all()
    )
    return [_attach_display_fields(db, r) for r in reservations]


def list_reservations_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[TableReservation]:
    assert_restaurant_access(db, current_user, restaurant_id)
    reservations = (
        db.query(TableReservation)
        .join(RestaurantTable, TableReservation.table_id == RestaurantTable.id)
        .filter(RestaurantTable.restaurant_id == restaurant_id)
        .order_by(TableReservation.reservation_start)
        .all()
    )
    return [_attach_display_fields(db, r) for r in reservations]


def get_reservation_or_404(db: Session, reservation_id: uuid.UUID) -> TableReservation:
    reservation = db.query(TableReservation).filter(TableReservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found.")
    return reservation


def update_reservation_status(
    db: Session, current_user: User, reservation_id: uuid.UUID, new_status: ReservationStatus
) -> TableReservation:
    reservation = get_reservation_or_404(db, reservation_id)
    table = get_table_or_404(db, reservation.table_id)
    assert_restaurant_access(db, current_user, table.restaurant_id)

    reservation.status = new_status

    if new_status == ReservationStatus.SEATED:
        table.status = table.status.__class__.OCCUPIED
    elif new_status in (ReservationStatus.COMPLETED, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW):
        table.status = table.status.__class__.AVAILABLE

    db.commit()
    db.refresh(reservation)
    return _attach_display_fields(db, reservation)


def cancel_reservation(db: Session, current_user: User, reservation_id: uuid.UUID) -> TableReservation:
    reservation = get_reservation_or_404(db, reservation_id)

    if current_user.role.value == "CUSTOMER" and reservation.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own reservations.",
        )

    if reservation.status in (ReservationStatus.COMPLETED, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a reservation with status {reservation.status.value}.",
        )

    reservation.status = ReservationStatus.CANCELLED
    db.commit()
    db.refresh(reservation)
    return _attach_display_fields(db, reservation)


def list_drivers_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[User]:
    assert_restaurant_access(db, current_user, restaurant_id)
    return (
        db.query(User)
        .filter(User.restaurant_id == restaurant_id, User.role == RoleEnum.DELIVERY, User.is_active == True)  # noqa: E712
        .all()
    )