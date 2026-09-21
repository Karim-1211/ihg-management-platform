"""Newsletter subscription service. Subscribing is deliberately
idempotent, and the public endpoint returns the same friendly message
whether or not the address was already on the list — so the form can
never be used to probe who is subscribed."""

import csv
import io

from sqlalchemy.orm import Session

from app.models.newsletter import NewsletterSubscriber


def subscribe(
    db: Session,
    email: str,
        first_name: str | None = None,
        last_name: str | None = None,
        zip_code: str | None = None,
        source: str = "website",
) -> tuple[NewsletterSubscriber, bool]:
    normalized = email.strip().lower()
    existing = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == normalized).first()

    if existing:
        was_already_active = existing.is_active
        if not existing.is_active:
            existing.is_active = True
            existing.unsubscribed_at = None
        if first_name and not existing.first_name:
            existing.first_name = first_name.strip()
        if last_name and not existing.last_name:
            existing.last_name = last_name.strip()
        if zip_code and not existing.zip_code:
            existing.zip_code = zip_code.strip()
        db.commit()
        db.refresh(existing)
        return existing, was_already_active

    subscriber = NewsletterSubscriber(
        email=normalized,
        first_name=first_name.strip() if first_name else None,
        last_name=last_name.strip() if last_name else None,
        zip_code=zip_code.strip() if zip_code else None,
        source=source,
        is_active=True,
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    return subscriber, False


def list_subscribers(db: Session, active_only: bool = True) -> list[NewsletterSubscriber]:
    query = db.query(NewsletterSubscriber)
    if active_only:
        query = query.filter(NewsletterSubscriber.is_active == True)  # noqa: E712
    return query.order_by(NewsletterSubscriber.created_at.desc()).all()


def export_csv(db: Session, active_only: bool = True) -> str:
    subscribers = list_subscribers(db, active_only=active_only)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["first_name", "last_name", "email", "zip_code", "source", "is_active", "subscribed_at"])
    for s in subscribers:
        writer.writerow([
            s.first_name or "",
            s.last_name or "",
            s.email,
            s.zip_code or "",
            s.source,
            "yes" if s.is_active else "no",
            s.created_at.isoformat() if s.created_at else "",
        ])
    return buffer.getvalue()