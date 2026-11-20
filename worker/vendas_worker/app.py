"""API HTTP do worker (chamada só pelo servidor do apps/web) + agendador dos jobs."""
from __future__ import annotations

import hmac
import logging
import threading
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

from . import conversions, telegram
from .config import Settings
from .db import Db
from .shopee import ShopeeClient, ShopeeError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("vendas_worker")
settings = Settings.load()
_job_locks = {"telegram": threading.Lock(), "conversions": threading.Lock()}


def shopee_client() -> ShopeeClient:
    settings.require("shopee_app_id", "shopee_app_secret")
    return ShopeeClient(settings.shopee_app_id, settings.shopee_app_secret, settings.shopee_api_url)


def db() -> Db:
    settings.require("supabase_url", "supabase_service_key")
    return Db(settings.supabase_url, settings.supabase_service_key)


def run_job(name: str) -> dict:
    lock = _job_locks[name]
    if not lock.acquire(blocking=False):
        return {"skipped": "já em execução"}
    try:
        if name == "telegram":
            settings.require("telegram_bot_token")
            return telegram.run(db(), telegram.TelegramBot(settings.telegram_bot_token),
                                settings.telegram_max_delay_min, settings.telegram_max_attempts)
        return conversions.run(db(), shopee_client(), settings.shopee_conversions_days,
                               settings.shopee_default_store_slug)
    finally:
        lock.release()


def _safe(name: str):
    try:
        run_job(name)
    except Exception:  # o agendador não pode morrer por um erro de job
        log.exception("job %s falhou", name)


@asynccontextmanager
async def lifespan(_: FastAPI):
    sched = None
    if settings.run_scheduler:
        from apscheduler.schedulers.background import BackgroundScheduler
        sched = BackgroundScheduler(timezone="UTC", job_defaults={"coalesce": True, "max_instances": 1})
        if settings.telegram_bot_token:
            sched.add_job(_safe, "interval", args=["telegram"], seconds=settings.telegram_interval_sec, id="telegram")
        if settings.shopee_app_id and settings.shopee_app_secret:
            sched.add_job(_safe, "interval", args=["conversions"], minutes=settings.shopee_conversions_interval_min,
                          id="conversions")
        sched.start()
        log.info("agendador ativo: %s", [j.id for j in sched.get_jobs()])
    yield
    if sched:
        sched.shutdown(wait=False)


app = FastAPI(title="vendas-worker", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def auth(authorization: Annotated[str, Header()] = "") -> None:
    token = settings.worker_token
    if not token:
        raise HTTPException(503, "WORKER_TOKEN não configurado")
    if not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(401, "não autorizado")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/shopee/offers", dependencies=[Depends(auth)])
def shopee_offers(
    keyword: str = "",
    category: int | None = Query(None, ge=1),
    sort: str = Query("relevance", pattern="^(relevance|sales|commission|discount|score)$"),
    page: int = Query(1, ge=1, le=100),
    limit: int = Query(30, ge=1, le=50),
):
    try:
        return shopee_client().product_offers(keyword, category, sort, page, limit)
    except ShopeeError as e:
        raise HTTPException(502, str(e))


class ShortLinkIn(BaseModel):
    origin_url: str = Field(max_length=2000)
    sub_ids: list[str] = Field(default_factory=list, max_length=5)


@app.post("/shopee/shortlink", dependencies=[Depends(auth)])
def shopee_shortlink(body: ShortLinkIn):
    try:
        return {"short_link": shopee_client().short_link(body.origin_url, body.sub_ids)}
    except ShopeeError as e:
        raise HTTPException(502, str(e))


@app.post("/jobs/{name}", dependencies=[Depends(auth)])
def trigger_job(name: str):
    """Dispara um job na hora (útil com cron externo se RUN_SCHEDULER=false)."""
    if name not in _job_locks:
        raise HTTPException(404, "job desconhecido")
    try:
        return run_job(name)
    except Exception as e:
        log.exception("job %s falhou", name)
        raise HTTPException(500, str(e)[:300])
