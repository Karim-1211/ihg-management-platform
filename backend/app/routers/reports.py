from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.reports import ExecutiveReportResponse
from app.services import report_service

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.get("/executive", response_model=ExecutiveReportResponse)
def get_executive_report(
    period: str = Query(default="last_30_days"),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return report_service.get_executive_report(db, current_user, period, start, end)