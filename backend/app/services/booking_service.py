import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.hotel import (
    Room, RoomType, Booking, BookingStatus, RoomStatus,
    HousekeepingTask, HousekeepingStatus,
)
from app.models.user import User
from app.schemas.hotel import BookingCreate, BookingCheckoutCreate
from app.schemas.notification_event import NotificationEvent
from app.models.notification import NotificationType
from app.services import audit_service
from app.services import notification_service
from app.services import business_rule_service


def generate_booking_reference() -> str:
    return f"BK{uuid.uuid4().hex[:8].upper()}"


def has_overlapping_booking(
    db: Session,
    room_id: uuid.UUID,
    check_in_date: date,
    check_out_date: date,
    exclude_booking_id: uuid.UUID | None = None,
) -> bool:
    query = db.query(Booking).filter(
        Booking.room_id == room_id,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        Booking.check_in_date < check_out_date,
        Booking.check_out_date > check_in_date,
    )
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
    return db.query(query.exists()).scalar()


def create_booking(db: Session, guest: User, data: BookingCreate) -> Booking:
    if data.check_out_date <= data.check_in_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Check-out date must be after check-in date.",
        )

    room = db.query(Room).filter(Room.id == data.room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")

    if room.status in (RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room is currently unavailable for bookings.",
        )

    # ---------- Phase 18.7A: Category B booking policy enforcement ----------
    nights = (data.check_out_date - data.check_in_date).days

    min_nights = business_rule_service.get_minimum_stay_nights(db, hotel_id=room.hotel_id)
    if nights < min_nights:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"This booking must cover at least {min_nights} night(s).",
        )

    max_nights = business_rule_service.get_maximum_stay_nights(db, hotel_id=room.hotel_id)
    if nights > max_nights:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"This booking cannot exceed {max_nights} night(s).",
        )

    max_advance_days = business_rule_service.get_maximum_advance_booking_days(db, hotel_id=room.hotel_id)
    today = datetime.now(timezone.utc).date()
    if (data.check_in_date - today).days > max_advance_days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Bookings cannot be made more than {max_advance_days} day(s) in advance.",
        )
    # ---------- end Category B enforcement ----------

    if has_overlapping_booking(db, room.id, data.check_in_date, data.check_out_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room is already booked for the selected dates.",
        )

    room_type = db.query(RoomType).filter(RoomType.id == room.room_type_id).first()
    total_amount = float(room_type.base_price) * nights

    booking = Booking(
        booking_reference=generate_booking_reference(),
        guest_id=guest.id,
        room_id=room.id,
        check_in_date=data.check_in_date,
        check_out_date=data.check_out_date,
        number_of_guests=data.number_of_guests,
        status=BookingStatus.CONFIRMED,
        total_amount=total_amount,
        special_requests=data.special_requests,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    audit_service.log_action(
        db, guest.id, "CREATE_BOOKING", "booking", booking.id,
        f"Created booking {booking.booking_reference} for room {room.room_number}",
    )
    # The confirmation email is built from this metadata, so everything the
    # guest should see in it — the room, the length of stay, and above all
    # their own special request — has to travel with the event.
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.BOOKING_CONFIRMED,
        actor_user_id=guest.id,
        entity_type="booking",
        entity_id=booking.id,
        hotel_id=room.hotel_id,
        metadata={
            "customer_id": str(guest.id),
            "booking_reference": booking.booking_reference,
            "check_in_date": str(booking.check_in_date),
            "check_out_date": str(booking.check_out_date),
            "room_number": room.room_number,
            "room_type": room_type.name if room_type else None,
            "nights": str(nights),
            "number_of_guests": str(booking.number_of_guests),
            "total_amount": str(booking.total_amount),
            "special_requests": booking.special_requests or None,
        },
    ))
    return booking


def get_booking_or_404(db: Session, booking_id: uuid.UUID) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    return booking


def list_bookings(db: Session, guest_id: uuid.UUID | None = None) -> list[Booking]:
    query = db.query(Booking)
    if guest_id:
        query = query.filter(Booking.guest_id == guest_id)
    return query.order_by(Booking.created_at.desc()).all()


def check_in_booking(db: Session, booking_id: uuid.UUID, current_user: User) -> Booking:
    booking = get_booking_or_404(db, booking_id)
    if booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot check in a booking with status {booking.status.value}.",
        )
    booking.status = BookingStatus.CHECKED_IN
    db.commit()
    db.refresh(booking)

    audit_service.log_action(
        db, current_user.id, "CHECK_IN", "booking", booking.id,
        f"Checked in booking {booking.booking_reference}",
    )
    room = db.query(Room).filter(Room.id == booking.room_id).first()
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.CHECK_IN_COMPLETED,
        actor_user_id=current_user.id,
        entity_type="booking",
        entity_id=booking.id,
        hotel_id=room.hotel_id if room else None,
        metadata={
            "customer_id": str(booking.guest_id),
            "room_number": room.room_number if room else "N/A",
        },
    ))
    return booking


def check_out_booking(db: Session, booking_id: uuid.UUID, current_user: User) -> Booking:
    booking = get_booking_or_404(db, booking_id)
    if booking.status != BookingStatus.CHECKED_IN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot check out a booking with status {booking.status.value}.",
        )
    booking.status = BookingStatus.CHECKED_OUT

    room = db.query(Room).filter(Room.id == booking.room_id).first()
    room.status = RoomStatus.CLEANING

    housekeeping_task = HousekeepingTask(
        room_id=room.id,
        status=HousekeepingStatus.PENDING,
        notes=f"Auto-created after checkout of booking {booking.booking_reference}",
    )
    db.add(housekeeping_task)

    db.commit()
    db.refresh(booking)

    audit_service.log_action(
        db, current_user.id, "CHECK_OUT", "booking", booking.id,
        f"Checked out booking {booking.booking_reference}, room {room.room_number} sent to housekeeping",
    )

    from app.services import billing_service
    billing_service.generate_invoice_for_booking(db, booking)

    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.CHECK_OUT_COMPLETED,
        actor_user_id=current_user.id,
        entity_type="booking",
        entity_id=booking.id,
        hotel_id=room.hotel_id,
        metadata={
            "customer_id": str(booking.guest_id),
            "room_number": room.room_number,
        },
    ))
    return booking


def cancel_booking(db: Session, booking_id: uuid.UUID, current_user: User) -> Booking:
    booking = get_booking_or_404(db, booking_id)

    if current_user.role.value == "CUSTOMER" and booking.guest_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own bookings.",
        )

    if booking.status in (BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a booking with status {booking.status.value}.",
        )

    # ---------- Phase 18.7A: cancellation deadline enforcement ----------
    # Check-in moment = check_in_date at 00:00 UTC, per the locked business-local
    # convention (same as Dashboard/Reports day boundaries). No hourly precision
    # is invented and the Booking model is not altered.
    room = db.query(Room).filter(Room.id == booking.room_id).first()
    deadline_hours = business_rule_service.get_cancellation_deadline_hours(db, hotel_id=room.hotel_id if room else None)
    if deadline_hours > 0:
        check_in_moment = datetime(
            booking.check_in_date.year, booking.check_in_date.month, booking.check_in_date.day,
            tzinfo=timezone.utc,
        )
        deadline_moment = check_in_moment - timedelta(hours=float(deadline_hours))
        now = datetime.now(timezone.utc)
        if now > deadline_moment:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"This booking cannot be cancelled within {deadline_hours} hour(s) of check-in. "
                    f"Cancellation deadline was {deadline_moment.isoformat()}."
                ),
            )
    # ---------- end cancellation deadline enforcement ----------

    booking.status = BookingStatus.CANCELLED
    db.commit()
    db.refresh(booking)

    audit_service.log_action(
        db, current_user.id, "CANCEL_BOOKING", "booking", booking.id,
        f"Cancelled booking {booking.booking_reference}",
    )
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.BOOKING_CANCELLED,
        actor_user_id=current_user.id,
        entity_type="booking",
        entity_id=booking.id,
        metadata={
            "customer_id": str(booking.guest_id),
            "booking_reference": booking.booking_reference,
        },
    ))
    return booking


def list_available_rooms(
    db: Session, check_in_date: date, check_out_date: date, hotel_id: uuid.UUID | None = None
) -> list[Room]:
    query = db.query(Room).filter(Room.status == RoomStatus.READY)
    if hotel_id:
        query = query.filter(Room.hotel_id == hotel_id)

    candidates = query.all()
    return [
        room for room in candidates
        if not has_overlapping_booking(db, room.id, check_in_date, check_out_date)
    ]


def _attach_room_number(db: Session, task: HousekeepingTask) -> HousekeepingTask:
    room = db.query(Room).filter(Room.id == task.room_id).first()
    if room:
        task.room_number = room.room_number
    return task


def list_housekeeping_tasks(db: Session, assigned_to: uuid.UUID | None = None) -> list[HousekeepingTask]:
    query = db.query(HousekeepingTask)
    if assigned_to:
        query = query.filter(HousekeepingTask.assigned_to == assigned_to)
    tasks = query.order_by(HousekeepingTask.created_at.desc()).all()
    return [_attach_room_number(db, t) for t in tasks]


def update_housekeeping_task(
    db: Session, task_id: uuid.UUID, new_status: HousekeepingStatus, notes: str | None
) -> HousekeepingTask:
    task = db.query(HousekeepingTask).filter(HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping task not found.")

    task.status = new_status
    if notes is not None:
        task.notes = notes

    if new_status == HousekeepingStatus.DONE:
        task.completed_at = datetime.now(timezone.utc)
        room = db.query(Room).filter(Room.id == task.room_id).first()
        room.status = RoomStatus.READY

    db.commit()
    db.refresh(task)
    return _attach_room_number(db, task)

def create_booking_checkout(db: Session, guest: User, data: BookingCheckoutCreate):
    """Atomically reserve a room and complete its demo payment.

    The room row is locked before the overlap check, so two simultaneous
    checkout requests cannot both reserve the same room for overlapping dates.
    """
    from app.models.billing import Invoice, InvoiceType, InvoiceStatus, Payment, PaymentStatus
    from app.services.billing_service import generate_invoice_number, generate_payment_number

    if data.check_out_date <= data.check_in_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Check-out date must be after check-in date.",
        )

    room = (
        db.query(Room)
        .filter(Room.id == data.room_id)
        .with_for_update()
        .first()
    )
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")

    if room.status != RoomStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room is not currently ready for booking.",
        )

    room_type = db.query(RoomType).filter(RoomType.id == room.room_type_id).first()
    if not room_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room type not found.")

    if data.number_of_guests > room_type.max_occupancy:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"This room allows a maximum of {room_type.max_occupancy} guest(s).",
        )

    nights = (data.check_out_date - data.check_in_date).days

    min_nights = business_rule_service.get_minimum_stay_nights(db, hotel_id=room.hotel_id)
    if nights < min_nights:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"This booking must cover at least {min_nights} night(s).",
        )

    max_nights = business_rule_service.get_maximum_stay_nights(db, hotel_id=room.hotel_id)
    if nights > max_nights:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"This booking cannot exceed {max_nights} night(s).",
        )

    max_advance_days = business_rule_service.get_maximum_advance_booking_days(db, hotel_id=room.hotel_id)
    today = datetime.now(timezone.utc).date()
    if (data.check_in_date - today).days > max_advance_days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Bookings cannot be made more than {max_advance_days} day(s) in advance.",
        )

    if has_overlapping_booking(db, room.id, data.check_in_date, data.check_out_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room is already booked for the selected dates.",
        )

    room_charge = Decimal(str(room_type.base_price)) * nights
    tax_rate = business_rule_service.get_tax_rate(db)
    tax_amount = (room_charge * tax_rate).quantize(Decimal("0.01"))
    total_amount = (room_charge + tax_amount).quantize(Decimal("0.01"))

    booking = Booking(
        booking_reference=generate_booking_reference(),
        guest_id=guest.id,
        room_id=room.id,
        check_in_date=data.check_in_date,
        check_out_date=data.check_out_date,
        number_of_guests=data.number_of_guests,
        guest_name=data.guest_name.strip(),
        guest_email=str(data.guest_email),
        guest_phone=data.guest_phone.strip() if data.guest_phone else None,
        status=BookingStatus.CONFIRMED,
        total_amount=room_charge,
        special_requests=data.special_requests.strip() if data.special_requests else None,
    )
    db.add(booking)
    db.flush()

    invoice = Invoice(
        invoice_number=generate_invoice_number(),
        invoice_type=InvoiceType.HOTEL,
        booking_id=booking.id,
        customer_id=guest.id,
        room_charge=room_charge,
        service_charge=Decimal("0.00"),
        subtotal=room_charge,
        tax_amount=tax_amount,
        discount_amount=Decimal("0.00"),
        total_amount=total_amount,
        amount_paid=total_amount,
        status=InvoiceStatus.PAID,
    )
    db.add(invoice)
    db.flush()

    payment = Payment(
        payment_number=generate_payment_number(),
        invoice_id=invoice.id,
        amount=total_amount,
        method=data.payment_method,
        status=PaymentStatus.COMPLETED,
        provider="DEMO",
        provider_reference=f"DEMO-{data.payment_method.value}-{uuid.uuid4().hex[:10].upper()}",
        notes="Demo hotel booking checkout payment",
        created_by=guest.id,
        paid_at=datetime.now(timezone.utc),
    )
    db.add(payment)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(booking)
    db.refresh(invoice)
    db.refresh(payment)

    audit_service.log_action(
        db,
        guest.id,
        "CREATE_BOOKING_CHECKOUT",
        "booking",
        booking.id,
        f"Created and paid booking {booking.booking_reference} for room {room.room_number} via {data.payment_method.value}",
    )
    # Everything the confirmation email shows comes from this metadata —
    # including the guest's own special request, which previously never
    # left the database.
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.BOOKING_CONFIRMED,
        actor_user_id=guest.id,
        entity_type="booking",
        entity_id=booking.id,
        hotel_id=room.hotel_id,
        metadata={
            "customer_id": str(guest.id),
            "booking_reference": booking.booking_reference,
            "check_in_date": str(booking.check_in_date),
            "check_out_date": str(booking.check_out_date),
            "room_number": room.room_number,
            "room_type": room_type.name if room_type else None,
            "nights": str(nights),
            "number_of_guests": str(booking.number_of_guests),
            "total_amount": str(total_amount),
            "special_requests": booking.special_requests or None,
        },
    ))
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.INVOICE_CREATED,
        actor_user_id=guest.id,
        entity_type="invoice",
        entity_id=invoice.id,
        hotel_id=room.hotel_id,
        metadata={
            "customer_id": str(guest.id),
            "invoice_number": invoice.invoice_number,
            "total_amount": str(invoice.total_amount),
        },
    ))
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.PAYMENT_COMPLETED,
        actor_user_id=guest.id,
        entity_type="payment",
        entity_id=payment.id,
        hotel_id=room.hotel_id,
        metadata={
            "customer_id": str(guest.id),
            "amount": str(payment.amount),
            "invoice_number": invoice.invoice_number,
        },
    ))

    return {
        "booking": booking,
        "invoice_id": invoice.id,
        "payment_id": payment.id,
        "payment_method": payment.method,
        "amount_paid": float(payment.amount),
        "total_amount": float(invoice.total_amount),
    }