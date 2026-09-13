"""Phase 23.3 — transactional import writer. Takes CSV rows through the
23.2 validation/preview layer, then commits only the valid rows in ONE
atomic transaction: either the whole batch succeeds, or nothing is
written (per the locked 23.1 "no orphaned partial records" requirement).
Guest accounts are created with a cryptographically random, never-
communicated password hash — never a guessable placeholder — matching
the exact hashing mechanism already used by auth_service.register_user."""

import secrets
import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.hotel import Booking
from app.models.user import User, RoleEnum
from app.services import audit_service
from app.services.booking_import_service import build_preview, RowResult
from app.services.booking_service import generate_booking_reference


@dataclass
class ImportRowOutcome:
    row_number: int
    status: str  # "IMPORTED" | "SKIPPED"
    booking_reference: str | None
    guest_email: str | None
    issues: list[dict] = field(default_factory=list)  # [{level, field, message}]


@dataclass
class ImportReport:
    success: bool
    total_rows: int
    imported_count: int
    skipped_count: int
    warning_count: int
    column_errors: list[str]
    rows: list[ImportRowOutcome]
    fatal_error: str | None = None

    def to_report_rows(self) -> list[dict]:
        """Flat, CSV-ready structure — the concrete deliverable for the
        locked requirement #10 (structured error report that can later be
        exposed as a downloadable file). Not written to disk here; a
        router/export step can trivially serialize this with csv.DictWriter."""
        out = []
        for r in self.rows:
            if not r.issues:
                out.append({
                    "row_number": r.row_number, "status": r.status, "level": "",
                    "field": "", "message": "", "booking_reference": r.booking_reference or "",
                    "guest_email": r.guest_email or "",
                })
            for issue in r.issues:
                out.append({
                    "row_number": r.row_number, "status": r.status, "level": issue["level"],
                    "field": issue["field"], "message": issue["message"],
                    "booking_reference": r.booking_reference or "", "guest_email": r.guest_email or "",
                })
        return out


def _generate_unique_reference(db: Session, already_used_this_batch: set[str]) -> str:
    for _ in range(10):
        candidate = generate_booking_reference()
        if candidate not in already_used_this_batch and not db.query(Booking).filter(Booking.booking_reference == candidate).first():
            return candidate
    raise RuntimeError("Could not generate a unique booking reference after 10 attempts.")


def preview_import(db: Session, rows: list[dict], fieldnames: list[str]):
    """23.1 requirement #5 — preview at the service/API level, no writes.
    Thin pass-through to the 23.2 validation layer, kept here too so the
    router has one obvious place to call for both preview and commit."""
    return build_preview(db, rows, fieldnames)


def import_bookings(db: Session, rows: list[dict], fieldnames: list[str], current_user: User) -> ImportReport:
    """Validates, then commits valid rows in a single atomic transaction.
    Any unexpected failure during the write phase rolls back everything
    written so far in this call — no partial batch is ever left behind."""
    preview = build_preview(db, rows, fieldnames)

    if preview.column_errors:
        return ImportReport(
            success=False, total_rows=preview.total_rows, imported_count=0,
            skipped_count=preview.total_rows, warning_count=0,
            column_errors=preview.column_errors, rows=[],
        )

    outcomes: list[ImportRowOutcome] = []
    references_used_this_batch: set[str] = set()

    try:
        for row_result in preview.rows:
            issue_dicts = [{"level": i.level, "field": i.field, "message": i.message} for i in row_result.issues]

            if not row_result.will_import:
                outcomes.append(ImportRowOutcome(
                    row_number=row_result.row_number, status="SKIPPED",
                    booking_reference=row_result.raw.get("booking_reference"),
                    guest_email=row_result.raw.get("guest_email"),
                    issues=issue_dicts,
                ))
                continue

            norm = row_result.normalized

            if row_result.resolved_guest_id:
                guest = db.query(User).filter(User.id == row_result.resolved_guest_id).first()
            else:
                random_password = secrets.token_urlsafe(32)  # never communicated; account exists for record-keeping
                guest = User(
                    first_name=norm["guest_first_name"],
                    last_name=norm["guest_last_name"],
                    email=norm["guest_email"],
                    phone=norm["guest_phone"],
                    password_hash=hash_password(random_password),
                    role=RoleEnum.CUSTOMER,
                )
                db.add(guest)
                db.flush()

            reference = norm["booking_reference"] or _generate_unique_reference(db, references_used_this_batch)
            references_used_this_batch.add(reference)

            booking = Booking(
                booking_reference=reference,
                guest_id=guest.id,
                room_id=norm["room_id"],
                check_in_date=norm["check_in_date"],
                check_out_date=norm["check_out_date"],
                number_of_guests=norm["number_of_guests"],
                status=norm["status"],
                total_amount=norm["total_amount"],
                special_requests=norm["special_requests"],
            )
            db.add(booking)
            db.flush()

            outcomes.append(ImportRowOutcome(
                row_number=row_result.row_number, status="IMPORTED",
                booking_reference=reference, guest_email=norm["guest_email"], issues=issue_dicts,
            ))

        db.commit()

        for outcome in outcomes:
            if outcome.status == "IMPORTED":
                audit_service.log_action(
                    db, current_user.id, "IMPORT_HISTORICAL_BOOKING", "booking", None,
                    f"Imported historical booking {outcome.booking_reference} for {outcome.guest_email}",
                )

    except Exception as e:
        db.rollback()
        return ImportReport(
            success=False, total_rows=preview.total_rows, imported_count=0,
            skipped_count=preview.total_rows, warning_count=0,
            column_errors=[], rows=[],
            fatal_error=f"Import failed and was fully rolled back: {e}",
        )

    imported_count = sum(1 for o in outcomes if o.status == "IMPORTED")
    skipped_count = sum(1 for o in outcomes if o.status == "SKIPPED")
    warning_count = sum(1 for o in outcomes if any(i["level"] == "WARNING" for i in o.issues))

    return ImportReport(
        success=True, total_rows=preview.total_rows, imported_count=imported_count,
        skipped_count=skipped_count, warning_count=warning_count,
        column_errors=[], rows=outcomes,
    )