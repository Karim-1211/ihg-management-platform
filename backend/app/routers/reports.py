from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.schemas.reports import (
    ExecutiveReportResponse, HotelReportResponse, RestaurantReportResponse,
    DeliveryReportResponse, InventoryReportResponse, OperationsReportResponse,
)
from app.services import report_service

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


def _period_params(period: str = Query(default="last_30_days"), start: date | None = Query(default=None), end: date | None = Query(default=None)):
    return period, start, end


@router.get("/executive", response_model=ExecutiveReportResponse)
def get_executive_report(
    period: str = Query(default="last_30_days"), start: date | None = Query(default=None), end: date | None = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return report_service.get_executive_report(db, current_user, period, start, end)


@router.get("/hotel", response_model=HotelReportResponse)
def get_hotel_report(
    period: str = Query(default="last_30_days"), start: date | None = Query(default=None), end: date | None = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return report_service.get_hotel_report(db, current_user, period, start, end)


@router.get("/restaurant", response_model=RestaurantReportResponse)
def get_restaurant_report(
    period: str = Query(default="last_30_days"), start: date | None = Query(default=None), end: date | None = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return report_service.get_restaurant_report(db, current_user, period, start, end)


@router.get("/delivery", response_model=DeliveryReportResponse)
def get_delivery_report(
    period: str = Query(default="last_30_days"), start: date | None = Query(default=None), end: date | None = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return report_service.get_delivery_report(db, current_user, period, start, end)


@router.get("/inventory", response_model=InventoryReportResponse)
def get_inventory_report(
    period: str = Query(default="last_30_days"), start: date | None = Query(default=None), end: date | None = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return report_service.get_inventory_report(db, current_user, period, start, end)


@router.get("/operations", response_model=OperationsReportResponse)
def get_operations_report(
    period: str = Query(default="last_30_days"), start: date | None = Query(default=None), end: date | None = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return report_service.get_operations_report(db, current_user, period, start, end)