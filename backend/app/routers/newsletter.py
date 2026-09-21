from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum
from app.schemas.newsletter import (
    NewsletterSubscribeRequest,
    NewsletterSubscribeResponse,
    NewsletterSubscriberResponse,
)
from app.services import newsletter_service

router = APIRouter(prefix="/api/v1", tags=["Newsletter"])


@router.post("/newsletter/subscribe", response_model=NewsletterSubscribeResponse)
def subscribe(data: NewsletterSubscribeRequest, db: Session = Depends(get_db)):
    """Public — deliberately unauthenticated so any site visitor can join."""
    _, already = newsletter_service.subscribe(
        db,
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        zip_code=data.zip_code,
        source=data.source,
    )
    return NewsletterSubscribeResponse(
        message="Thank you — you're on the list. Look out for our next update.",
        already_subscribed=already,
    )


@router.get("/newsletter/subscribers", response_model=list[NewsletterSubscriberResponse])
def list_subscribers(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    subscribers = newsletter_service.list_subscribers(db, active_only=active_only)
    return [
        NewsletterSubscriberResponse(
            id=str(s.id), email=s.email, first_name=s.first_name, last_name=s.last_name,
            zip_code=s.zip_code, source=s.source, is_active=s.is_active, created_at=s.created_at,
        )
        for s in subscribers
    ]


@router.get("/newsletter/subscribers/export")
def export_subscribers(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    csv_text = newsletter_service.export_csv(db, active_only=active_only)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="newsletter_subscribers.csv"'},
    )