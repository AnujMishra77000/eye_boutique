from __future__ import annotations

import structlog

from app.db.session import SessionLocal
from app.services.campaign_service import CampaignService
from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="campaign.execute", bind=True)
def execute_campaign_task(self, campaign_id: int) -> dict[str, str | int]:
    logger.info("campaign.task.started", campaign_id=campaign_id, task_id=self.request.id)

    with SessionLocal() as db:
        service = CampaignService(db)
        service.execute_campaign_with_recovery(campaign_id)

    logger.info("campaign.task.completed", campaign_id=campaign_id, task_id=self.request.id)
    return {"status": "completed", "campaign_id": campaign_id}
