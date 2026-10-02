from fastapi import APIRouter, BackgroundTasks, Depends, Query
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
def subscribe(
    data: NewsletterSubscribeRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Public — deliberately unauthenticated so any site visitor can join.

    Returns the welcome discount code alongside the confirmation, so the form
    can show it straight away rather than making the guest wait for email."""
    subscriber, already, promo = newsletter_service.subscribe_with_welcome_code(
        db,
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        zip_code=data.zip_code,
        source=data.source,
    )

    # Sent in the background so a slow mail server never delays the form.
    subject, html, text = newsletter_service.build_welcome_email(subscriber, promo)
    background.add_task(newsletter_service.send_welcome_email, subscriber.email, subject, html, text)

    if promo:
        percent = int(float(promo.percent_off) * 100)
        message = (
            f"You're already on the list — here's your {percent}% code again."
            if already
            else f"Welcome to the list. Here's {percent}% off your next booking, table or delivery."
        )
    else:
        message = "Thank you — you're on the list. Look out for our next update."

    return NewsletterSubscribeResponse(
        message=message,
        already_subscribed=already,
        promo_code=promo.code if promo else None,
        promo_percent_off=float(promo.percent_off) if promo else None,
        promo_expires_at=promo.expires_at if promo else None,
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