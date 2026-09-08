"""
Lock Scheduler
Runs an APScheduler job every 5 minutes to transition submitted assessments
whose lock_expires_at has passed to locked status.
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.assessment import Assessment
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

# Module-level scheduler instance so shutdown can reference it from main.py
scheduler = AsyncIOScheduler()


async def _lock_expired_assessments() -> None:
    """
    Query all submitted assessments with lock_expires_at <= now() and
    transition them to locked, writing an audit log entry for each.
    """
    now = datetime.now(tz=timezone.utc)

    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(Assessment).where(
                    Assessment.status == "submitted",
                    Assessment.lock_expires_at <= now,
                )
            )
            expired: list[Assessment] = list(result.scalars().all())

            if not expired:
                return

            for assessment in expired:
                assessment.status = "locked"
                assessment.locked_at = now

                session.add(
                    AuditLog(
                        event_type="assessment_locked",
                        actor_id=None,
                        actor_username="system",
                        actor_role="system",
                        entity_type="assessment",
                        entity_id=assessment.id,
                        description=(
                            f"Assessment id={assessment.id} automatically locked "
                            f"(lock_expires_at={assessment.lock_expires_at})"
                        ),
                    )
                )

            await session.commit()
            logger.info("Lock scheduler: locked %d assessment(s)", len(expired))

        except Exception:
            await session.rollback()
            logger.exception("Lock scheduler: error while locking assessments")
            raise


async def start_lock_scheduler(app: FastAPI) -> None:
    """
    Configure and start the APScheduler AsyncIOScheduler.
    Attach the scheduler instance to the app state for graceful shutdown.
    """
    scheduler.add_job(
        _lock_expired_assessments,
        trigger="interval",
        minutes=5,
        id="lock_expired_assessments",
        replace_existing=True,
        misfire_grace_time=60,
    )
    scheduler.start()
    app.state.scheduler = scheduler
    logger.info("Lock scheduler started (interval=5 minutes)")
