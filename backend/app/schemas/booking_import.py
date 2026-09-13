from pydantic import BaseModel


class ImportRowIssueResponse(BaseModel):
    level: str
    field: str
    message: str


class ImportRowResultResponse(BaseModel):
    row_number: int
    booking_reference: str | None
    guest_email: str | None
    will_import: bool
    issues: list[ImportRowIssueResponse]


class ImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    error_rows: int
    warning_rows: int
    column_errors: list[str]
    rows: list[ImportRowResultResponse]


class ImportRowOutcomeResponse(BaseModel):
    row_number: int
    status: str
    booking_reference: str | None
    guest_email: str | None
    issues: list[ImportRowIssueResponse]


class ImportReportResponse(BaseModel):
    success: bool
    total_rows: int
    imported_count: int
    skipped_count: int
    warning_count: int
    column_errors: list[str]
    rows: list[ImportRowOutcomeResponse]
    fatal_error: str | None = None