import csv
import io

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.booking_import import ImportPreviewResponse, ImportReportResponse
from app.services import booking_import_service, booking_import_writer

router = APIRouter(prefix="/api/v1/admin/bookings-import", tags=["Data Migration"])

# Phase 25 security hardening: the CSV import endpoint is SUPER_ADMIN-only,
# but had no protection against an accidentally or maliciously oversized
# file consuming excessive memory/time, nor a cap on how many rows a
# single request could attempt to process in one transaction. Both limits
# are enforced server-side, with a clear rejection rather than a silent
# truncation or an unbounded resource commitment.
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB — generous for a spreadsheet export, bounded against abuse
MAX_ROW_COUNT = 5000  # a single historical-import batch; larger migrations should be split into multiple files


async def _read_csv(file: UploadFile) -> tuple[list[dict], list[str]]:
    content = await file.read()

    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="File must be UTF-8 encoded CSV.")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    if len(rows) > MAX_ROW_COUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"File contains {len(rows)} rows, exceeding the maximum of {MAX_ROW_COUNT} per import. Please split into smaller files.",
        )

    return rows, reader.fieldnames or []


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    rows, fieldnames = await _read_csv(file)
    preview = booking_import_writer.preview_import(db, rows, fieldnames)
    return ImportPreviewResponse(
        total_rows=preview.total_rows, valid_rows=preview.valid_rows,
        error_rows=preview.error_rows, warning_rows=preview.warning_rows,
        column_errors=preview.column_errors,
        rows=[
            {
                "row_number": r.row_number, "booking_reference": r.raw.get("booking_reference"),
                "guest_email": r.raw.get("guest_email"), "will_import": r.will_import,
                "issues": [{"level": i.level, "field": i.field, "message": i.message} for i in r.issues],
            }
            for r in preview.rows
        ],
    )


@router.post("/commit", response_model=ImportReportResponse)
async def commit_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    rows, fieldnames = await _read_csv(file)
    report = booking_import_writer.import_bookings(db, rows, fieldnames, current_user)
    return ImportReportResponse(
        success=report.success, total_rows=report.total_rows, imported_count=report.imported_count,
        skipped_count=report.skipped_count, warning_count=report.warning_count,
        column_errors=report.column_errors, fatal_error=report.fatal_error,
        rows=[
            {
                "row_number": o.row_number, "status": o.status, "booking_reference": o.booking_reference,
                "guest_email": o.guest_email, "issues": o.issues,
            }
            for o in report.rows
        ],
    )