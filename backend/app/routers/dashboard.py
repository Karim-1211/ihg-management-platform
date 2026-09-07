from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.dashboard import DashboardOverviewResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return dashboard_service.get_dashboard_overview(db, current_user)