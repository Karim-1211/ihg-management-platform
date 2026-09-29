"""Background email sender.

Emails are queued as PENDING rows by notification_service.dispatch(), which
deliberately does not send them inline — a slow or failing mail server must
never delay or break the booking, order or payment that triggered it.

This worker drains that queue on a loop inside the API process. No cron, no
second service to deploy. The manual "Process Pending Emails" button still
works and calls exactly the same processor.
"""
import asyncio
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.services import notification_processor

logger = logging.getLogger("ihg.email_worker")

# How often to look for queued mail. Short enough that a guest's booking
# confirmation feels immediate, long enough to be negligible load.
POLL_SECONDS = 10

# After a failure, back off so a mail-server outage doesn't hammer it every
# ten seconds for hours.
BACKOFF_SECONDS = 60

_task: asyncio.Task | None = None


async def _run() -> None:
    logger.info("Email worker started (mode=%s, every %ss)", settings.email_mode, POLL_SECONDS)
    while True:
        delay = POLL_SECONDS
        db = SessionLocal()
        try:
            # Runs in a thread so the blocking SMTP call never stalls the
            # event loop — the API keeps serving requests while mail sends.
            result = await asyncio.to_thread(notification_processor.process_pending_emails, db)
            if isinstance(result, dict):
                sent = result.get("sent") or result.get("processed") or 0
                failed = result.get("failed") or 0
                if sent or failed:
                    logger.info("Email worker: %s sent, %s failed", sent, failed)
                if failed and not sent:
                    delay = BACKOFF_SECONDS
        except asyncio.CancelledError:
            raise
        except Exception:
            # Never let a failure kill the loop — the queue is durable, so
            # anything unsent is simply retried on the next pass.
            logger.exception("Email worker pass failed; backing off")
            delay = BACKOFF_SECONDS
        finally:
            db.close()

        await asyncio.sleep(delay)


def start() -> None:
    global _task
    if _task and not _task.done():
        return
    _task = asyncio.create_task(_run())


async def stop() -> None:
    global _task
    if not _task:
        return
    _task.cancel()
    try:
        await _task
    except asyncio.CancelledError:
        pass
    _task = None
    logger.info("Email worker stopped")