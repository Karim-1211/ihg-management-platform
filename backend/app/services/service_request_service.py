import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.hotel import Booking, BookingStatus, Room
from app.models.service_request import ServiceRequest, ServiceRequestStatus
from app.models.user import User
from app.schemas.hotel import ServiceRequestCreate
from app.services import audit_service


def _attach_display_fields(db: Session, request: ServiceRequest) -> ServiceRequest:
    booking = db.query(Booking).filter(Booking.id == request.booking_id).first()
    if booking:
        request.booking_reference = booking.booking_reference
        room = db.query(Room).filter(Room.id == booking.room_id).first()
        if room:
            request.room_number = room.room_number
        guest = db.query(User).filter(User.id == booking.guest_id).first()
        if guest:
            request.guest_name = f"{guest.first_name} {guest.last_name}"
    return request


def create_service_request(db: Session, guest: User, data: ServiceRequestCreate) -> ServiceRequest:
    booking = db.query(Booking).filter(Booking.id == data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    if booking.guest_id != guest.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only request service for your own booking.",
        )

    if booking.status != BookingStatus.CHECKED_IN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Service requests are only available during an active stay (checked in).",
        )

    request = ServiceRequest(
        booking_id=booking.id,
        requested_by=guest.id,
        request_type=data.request_type,
        description=data.description,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _attach_display_fields(db, request)


def list_my_service_requests(db: Session, guest_id: uuid.UUID) -> list[ServiceRequest]:
    requests = (
        db.query(ServiceRequest)
        .filter(ServiceRequest.requested_by == guest_id)
        .order_by(ServiceRequest.created_at.desc())
        .all()
    )
    return [_attach_display_fields(db, r) for r in requests]


def list_all_service_requests(db: Session) -> list[ServiceRequest]:
    requests = db.query(ServiceRequest).order_by(ServiceRequest.created_at.desc()).all()
    return [_attach_display_fields(db, r) for r in requests]


def update_service_request(
    db: Session,
    request_id: uuid.UUID,
    new_status: ServiceRequestStatus,
    assigned_to: uuid.UUID | None,
    price: float | None,
    current_user: User,
) -> ServiceRequest:
    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found.")

    request.status = new_status
    if assigned_to is not None:
        request.assigned_to = assigned_to
    if price is not None:
        request.price = price
    if new_status == ServiceRequestStatus.COMPLETED:
        request.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(request)

    if new_status == ServiceRequestStatus.COMPLETED:
        price_note = f" (charged ${price})" if price else " (no charge)"
        audit_service.log_action(
            db, current_user.id, "COMPLETE_SERVICE_REQUEST", "service_request", request.id,
            f"Completed {request.request_type.value} request{price_note}",
        )

    return _attach_display_fields(db, request)