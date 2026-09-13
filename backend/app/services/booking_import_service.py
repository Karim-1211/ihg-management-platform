"""Phase 23 — Data Migration: Guest + Booking historical import.

Locked design (23.1): a narrowly-scoped historical-import path. Applies
data-integrity and tenant/security checks identically to live bookings,
but explicitly does NOT apply forward-looking business policies (Phase
18.7A's cancellation deadline, min/max stay, advance-booking limits) or
the overlap rejection that create_booking enforces — overlaps are
demoted to a warning here, since the importer's purpose is to preserve
historical truth and surface data-quality issues, not silently discard
real historical events. This module contains only validation/preview
logic; no database writes happen here (see booking_import_writer.py
for the transactional import step, added in 23.3)."""

import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.models.hotel import Hotel, Room, Booking, BookingStatus
from app.models.user import User

REQUIRED_COLUMNS = {
    "guest_email", "guest_first_name", "guest_last_name",
    "hotel_name", "room_number", "check_in_date", "check_out_date", "total_amount",
}
OPTIONAL_COLUMNS = {
    "guest_phone", "number_of_guests", "status", "special_requests", "booking_reference",
}
ALL_KNOWN_COLUMNS = REQUIRED_COLUMNS | OPTIONAL_COLUMNS

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

CSV_TEMPLATE_HEADER = (
    "guest_email,guest_first_name,guest_last_name,guest_phone,hotel_name,room_number,"
    "check_in_date,check_out_date,number_of_guests,total_amount,status,special_requests,booking_reference"
)
CSV_TEMPLATE_EXAMPLE_ROW = (
    "jane.doe@example.com,Jane,Doe,+1234567890,IHG Grand Dhaka,204,"
    "2025-03-01,2025-03-04,2,450.00,CHECKED_OUT,Late checkout requested,"
)


@dataclass
class RowIssue:
    level: str  # "ERROR" | "WARNING"
    field: str
    message: str


@dataclass
class RowResult:
    row_number: int  # 1-based, matching a human looking at the CSV (header = row 0)
    raw: dict
    issues: list[RowIssue] = field(default_factory=list)
    resolved_hotel_id: uuid.UUID | None = None
    resolved_room_id: uuid.UUID | None = None
    resolved_guest_id: uuid.UUID | None = None
    will_create_guest: bool = False
    normalized: dict | None = None  # values ready for import if this row has no ERROR-level issues

    @property
    def has_errors(self) -> bool:
        return any(i.level == "ERROR" for i in self.issues)

    @property
    def has_warnings(self) -> bool:
        return any(i.level == "WARNING" for i in self.issues)

    @property
    def will_import(self) -> bool:
        return not self.has_errors


@dataclass
class ImportPreview:
    total_rows: int
    valid_rows: int
    error_rows: int
    warning_rows: int
    column_errors: list[str]
    rows: list[RowResult]


def _parse_date(value: str) -> date | None:
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        return None


def _parse_amount(value: str) -> Decimal | None:
    try:
        d = Decimal(str(value).strip())
        return d
    except (InvalidOperation, AttributeError):
        return None


def _parse_int(value: str, default: int | None = None) -> int | None:
    if value is None or str(value).strip() == "":
        return default
    try:
        return int(str(value).strip())
    except ValueError:
        return None


def validate_columns(fieldnames: list[str]) -> list[str]:
    """Returns a list of column-level errors (missing required columns).
    Unknown extra columns are ignored, not treated as errors — future CSVs
    exported from other systems commonly carry extra metadata columns."""
    present = set(fieldnames or [])
    missing = REQUIRED_COLUMNS - present
    errors = []
    if missing:
        errors.append(f"Missing required column(s): {', '.join(sorted(missing))}")
    return errors


def _check_overlap(db: Session, room_id: uuid.UUID, check_in: date, check_out: date) -> list[dict]:
    """Returns a list of conflicting bookings (id + reference + dates) for
    reporting — demoted to a WARNING per the locked 23.1 decision, never a
    hard failure, since historical double-bookings are real data-quality
    findings the importer should surface, not silently discard."""
    conflicts = (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.status.notin_([BookingStatus.CANCELLED]),
            Booking.check_in_date < check_out,
            Booking.check_out_date > check_in,
        )
        .all()
    )
    return [
        {"booking_reference": c.booking_reference, "check_in_date": str(c.check_in_date), "check_out_date": str(c.check_out_date)}
        for c in conflicts
    ]


def validate_row(db: Session, row_number: int, raw: dict, seen_references: set[str]) -> RowResult:
    result = RowResult(row_number=row_number, raw=raw)

    def err(field_name: str, message: str):
        result.issues.append(RowIssue(level="ERROR", field=field_name, message=message))

    def warn(field_name: str, message: str):
        result.issues.append(RowIssue(level="WARNING", field=field_name, message=message))

    guest_email = (raw.get("guest_email") or "").strip()
    guest_first_name = (raw.get("guest_first_name") or "").strip()
    guest_last_name = (raw.get("guest_last_name") or "").strip()
    hotel_name = (raw.get("hotel_name") or "").strip()
    room_number = (raw.get("room_number") or "").strip()

    if not guest_email:
        err("guest_email", "guest_email is required.")
    elif not _EMAIL_RE.match(guest_email):
        err("guest_email", f"'{guest_email}' is not a valid email address.")

    if not guest_first_name:
        err("guest_first_name", "guest_first_name is required.")
    if not guest_last_name:
        err("guest_last_name", "guest_last_name is required.")

    if not hotel_name:
        err("hotel_name", "hotel_name is required.")
    if not room_number:
        err("room_number", "room_number is required.")

    check_in = _parse_date(raw.get("check_in_date", ""))
    if check_in is None:
        err("check_in_date", f"'{raw.get('check_in_date')}' is not a valid date (expected YYYY-MM-DD).")

    check_out = _parse_date(raw.get("check_out_date", ""))
    if check_out is None:
        err("check_out_date", f"'{raw.get('check_out_date')}' is not a valid date (expected YYYY-MM-DD).")

    if check_in is not None and check_out is not None and check_out <= check_in:
        err("check_out_date", "check_out_date must be after check_in_date.")

    total_amount = _parse_amount(raw.get("total_amount", ""))
    if total_amount is None:
        err("total_amount", f"'{raw.get('total_amount')}' is not a valid amount.")
    elif total_amount < 0:
        err("total_amount", "total_amount must not be negative.")

    number_of_guests = _parse_int(raw.get("number_of_guests"), default=1)
    if number_of_guests is None:
        err("number_of_guests", f"'{raw.get('number_of_guests')}' is not a valid whole number.")
    elif number_of_guests < 1:
        err("number_of_guests", "number_of_guests must be at least 1.")

    status_raw = (raw.get("status") or "").strip().upper()
    status_value = None
    if status_raw:
        try:
            status_value = BookingStatus(status_raw)
        except ValueError:
            err("status", f"'{status_raw}' is not a valid status. Valid values: {', '.join(s.value for s in BookingStatus)}.")
    else:
        status_value = BookingStatus.CHECKED_OUT  # historical import default, per 23.1

    booking_reference = (raw.get("booking_reference") or "").strip() or None
    if booking_reference:
        if booking_reference in seen_references:
            err("booking_reference", f"'{booking_reference}' is duplicated within this CSV file.")
        else:
            existing = db.query(Booking).filter(Booking.booking_reference == booking_reference).first()
            if existing:
                err("booking_reference", f"'{booking_reference}' already exists in the database.")

    # Resolve hotel and room only if the basic fields were even provided —
    # no point querying with an empty string.
    resolved_hotel = None
    resolved_room = None
    if hotel_name:
        resolved_hotel = db.query(Hotel).filter(Hotel.name == hotel_name).first()
        if not resolved_hotel:
            err("hotel_name", f"No hotel named '{hotel_name}' exists.")

    if resolved_hotel and room_number:
        resolved_room = db.query(Room).filter(Room.hotel_id == resolved_hotel.id, Room.room_number == room_number).first()
        if not resolved_room:
            err("room_number", f"No room '{room_number}' exists at hotel '{hotel_name}'.")

    # Overlap check — WARNING only, per the locked 23.1 decision, and only
    # attempted if we have everything needed to check it meaningfully.
    if resolved_room and check_in is not None and check_out is not None:
        conflicts = _check_overlap(db, resolved_room.id, check_in, check_out)
        if conflicts:
            conflict_summary = "; ".join(f"{c['booking_reference']} ({c['check_in_date']} to {c['check_out_date']})" for c in conflicts)
            warn("room_number", f"Overlaps with existing booking(s): {conflict_summary}. Row will still be imported for review.")

    # Resolve or plan guest creation — only meaningful if email/name are valid.
    resolved_guest = None
    will_create_guest = False
    if guest_email and _EMAIL_RE.match(guest_email):
        resolved_guest = db.query(User).filter(User.email == guest_email).first()
        if not resolved_guest and guest_first_name and guest_last_name:
            will_create_guest = True

    result.resolved_hotel_id = resolved_hotel.id if resolved_hotel else None
    result.resolved_room_id = resolved_room.id if resolved_room else None
    result.resolved_guest_id = resolved_guest.id if resolved_guest else None
    result.will_create_guest = will_create_guest

    if not result.has_errors:
        result.normalized = {
            "guest_email": guest_email,
            "guest_first_name": guest_first_name,
            "guest_last_name": guest_last_name,
            "guest_phone": (raw.get("guest_phone") or "").strip() or None,
            "check_in_date": check_in,
            "check_out_date": check_out,
            "number_of_guests": number_of_guests,
            "total_amount": total_amount,
            "status": status_value,
            "special_requests": (raw.get("special_requests") or "").strip() or None,
            "booking_reference": booking_reference,
            "room_id": resolved_room.id if resolved_room else None,
        }

    if seen_references is not None and booking_reference and not any(
        i.field == "booking_reference" and i.level == "ERROR" for i in result.issues
    ):
        seen_references.add(booking_reference)

    return result


def build_preview(db: Session, rows: list[dict], fieldnames: list[str]) -> ImportPreview:
    """Pure read-only validation pass — no database writes. Safe to call
    repeatedly, e.g. for a preview-before-commit workflow."""
    column_errors = validate_columns(fieldnames)

    row_results: list[RowResult] = []
    seen_references: set[str] = set()

    if not column_errors:
        for i, raw_row in enumerate(rows, start=1):
            row_results.append(validate_row(db, i, raw_row, seen_references))

    valid_count = sum(1 for r in row_results if r.will_import)
    error_count = sum(1 for r in row_results if r.has_errors)
    warning_count = sum(1 for r in row_results if r.has_warnings)

    return ImportPreview(
        total_rows=len(rows),
        valid_rows=valid_count,
        error_rows=error_count,
        warning_rows=warning_count,
        column_errors=column_errors,
        rows=row_results,
    )