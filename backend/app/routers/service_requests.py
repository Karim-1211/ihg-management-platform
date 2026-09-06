import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.hotel import (
    ServiceRequestCreate, ServiceRequestResponse, ServiceRequestStatusUpdate,
)
from app.services import service_request_service

router = APIRouter(prefix="/api/v1/service-requests", tags=["Service Requests"])


@router.post("", response_model=ServiceRequestResponse, status_code=201)
def create_service_request(
    data: ServiceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service_request_service.create_service_request(db, current_user, data)


@router.get("/my", response_model=list[ServiceRequestResponse])
def my_service_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service_request_service.list_my_service_requests(db, current_user.id)


@router.get("", response_model=list[ServiceRequestResponse])
def all_service_requests(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST, RoleEnum.HOUSEKEEPING)),
):
    return service_request_service.list_all_service_requests(db)


@router.patch("/{request_id}", response_model=ServiceRequestResponse)
def update_service_request(
    request_id: uuid.UUID,
    data: ServiceRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST, RoleEnum.HOUSEKEEPING)),
):
    return service_request_service.update_service_request(
        db, request_id, data.status, data.assigned_to, data.price, current_user
    )