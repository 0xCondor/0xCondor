from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "condor",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.scan_tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Rome",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "periodic-scheduled-scans": {
        "task": "app.tasks.scan_tasks.schedule_periodic_scans",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    "daily-score-snapshot": {
        "task": "app.tasks.scan_tasks.daily_score_snapshot",
        "schedule": crontab(minute=5, hour=2),
    },
}
