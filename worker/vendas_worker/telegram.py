"""Fase 4: envia scheduled_posts (channel_type=telegram, mode=auto) no horário e marca posted/failed."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

from .db import Db, in_list

log = logging.getLogger(__name__)

CAPTION_MAX = 1024
TEXT_MAX = 4096


@dataclass
class SendResult:
    ok: bool
    message_id: str | None = None
    error: str | None = None
    retryable: bool = False


class TelegramBot:
    def __init__(self, token: str, transport: httpx.BaseTransport | None = None):
        self._token = token
        self._transport = transport

    def _call(self, method: str, data: dict[str, Any]) -> SendResult:
        # o token vai na URL: nunca registrar a URL nem a exceção crua
        try:
            with httpx.Client(timeout=20.0, transport=self._transport) as http:
                r = http.post(f"https://api.telegram.org/bot{self._token}/{method}", json=data)
        except httpx.HTTPError as e:
            return SendResult(False, error=f"Telegram: falha de rede ({type(e).__name__})", retryable=True)
        try:
            body = r.json()
        except ValueError:
            body = {}
        if r.status_code == 200 and body.get("ok"):
            return SendResult(True, message_id=str((body.get("result") or {}).get("message_id", "")))
        desc = str(body.get("description") or f"HTTP {r.status_code}")[:300]
        return SendResult(False, error=f"Telegram {r.status_code}: {desc}", retryable=r.status_code == 429 or r.status_code >= 500)

    def send(self, chat_id: str, text: str, photo: str | None = None) -> SendResult:
        if photo and len(text) <= CAPTION_MAX:
            res = self._call("sendPhoto", {"chat_id": chat_id, "photo": photo, "caption": text})
            if res.ok or res.retryable:
                return res
            log.warning("sendPhoto falhou (%s); enviando só texto", res.error)
        if len(text) > TEXT_MAX:
            return SendResult(False, error=f"Texto com {len(text)} caracteres (limite do Telegram: {TEXT_MAX})")
        return self._call("sendMessage", {"chat_id": chat_id, "text": text})


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def run(db: Db, bot: TelegramBot, max_delay_min: int = 180, max_attempts: int = 3,
        now: datetime | None = None) -> dict[str, int]:
    now = now or _now()
    posts = db.rpc("claim_auto_posts", {"p_channel": "telegram", "p_limit": 20, "p_lock_minutes": 10}) or []
    stats = {"claimed": len(posts), "posted": 0, "failed": 0, "skipped": 0, "retry": 0}
    if not posts:
        return stats

    items = {c["id"]: c for c in db.select("content_items", {
        "select": "id,body,media_url,offers(status,products(image_url))",
        "id": in_list({p["content_item_id"] for p in posts}),
    })}
    chats = {}
    for ch in db.select("channels", {
        "select": "store_id,config,is_active", "type": "eq.telegram",
        "store_id": in_list({p["store_id"] for p in posts}),
    }):
        chat_id = str((ch.get("config") or {}).get("chat_id") or "").strip()
        if ch.get("is_active") and chat_id:
            chats[ch["store_id"]] = chat_id

    for p in posts:
        status, values = _process(p, items.get(p["content_item_id"]), chats.get(p["store_id"]), bot,
                                  now, max_delay_min, max_attempts)
        stats[status] += 1
        db.update("scheduled_posts", {"id": f"eq.{p['id']}"}, {**values, "locked_at": None})
        log.info("post %s → %s %s", p["id"], status, values.get("error") or "")
    return stats


def _process(post, item, chat_id, bot: TelegramBot, now, max_delay_min, max_attempts):
    late_min = (now - _parse(post["scheduled_at"])).total_seconds() / 60
    if late_min > max_delay_min:
        return "skipped", {"status": "skipped", "error": f"Atrasado {int(late_min)} min (limite {max_delay_min})"}
    if not item or not (item.get("body") or "").strip():
        return "failed", {"status": "failed", "error": "Conteúdo vazio ou removido"}
    if not chat_id:
        return "failed", {"status": "failed", "error": "Canal Telegram da loja sem chat_id (Configurar loja)"}
    offer = item.get("offers") or {}
    if offer and offer.get("status") not in (None, "active"):
        return "skipped", {"status": "skipped", "error": f"Oferta {offer.get('status')}"}

    photo = item.get("media_url") or ((offer.get("products") or {}).get("image_url") if offer else None)
    res = bot.send(chat_id, item["body"].strip(), photo)
    if res.ok:
        return "posted", {"status": "posted", "posted_at": now.isoformat(), "external_id": res.message_id, "error": None}
    if res.retryable and int(post.get("attempts") or 0) < max_attempts:
        return "retry", {"status": "pending", "error": res.error}
    return "failed", {"status": "failed", "error": res.error}
