import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_optional_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.media import MediaEntityType
from app.schemas.media import MediaCreate, MediaUpdate, MediaReorderRequest, MediaResponse
from app.services import media_service

router = APIRouter(prefix="/api/v1/media", tags=["Media"])


@router.get("", response_model=list[MediaResponse])
def list_media(
    entity_type: MediaEntityType = Query(...),
    entity_id: uuid.UUID = Query(...),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    # include_inactive only honored for staff — customers only ever see active media.
    honor_inactive = include_inactive and current_user is not None and current_user.role != RoleEnum.CUSTOMER
    return media_service.list_media(db, entity_type, entity_id, include_inactive=honor_inactive)


@router.post("", response_model=MediaResponse, status_code=201)
def create_media(
    data: MediaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return media_service.create_media(db, current_user, data)


@router.patch("/{media_id}", response_model=MediaResponse)
def update_media(
    media_id: uuid.UUID,
    data: MediaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return media_service.update_media(db, current_user, media_id, data)


@router.post("/{media_id}/set-primary", response_model=MediaResponse)
def set_primary(
    media_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return media_service.set_primary(db, current_user, media_id)


@router.post("/{media_id}/deactivate", response_model=MediaResponse)
def deactivate_media(
    media_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return media_service.set_active_status(db, current_user, media_id, is_active=False)


@router.post("/{media_id}/reactivate", response_model=MediaResponse)
def reactivate_media(
    media_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return media_service.set_active_status(db, current_user, media_id, is_active=True)


@router.post("/reorder", response_model=list[MediaResponse])
def reorder_media(
    data: MediaReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return media_service.reorder_media(db, current_user, data.entity_type, data.entity_id, data.ordered_ids)