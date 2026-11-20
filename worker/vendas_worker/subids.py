"""subIds da Shopee: [loja, canal, post]. A Shopee devolve no conversionReport como
utmContent = "sub1-sub2-sub3-sub4-sub5", por isso cada subId é só alfanumérico (sem "-")."""
from __future__ import annotations

import re

CHANNEL_CODE = {"whatsapp_channel": "wa", "telegram": "tg", "instagram": "ig", "tiktok": "tt"}
CODE_CHANNEL = {v: k for k, v in CHANNEL_CODE.items()}


def clean_subid(value: str | None) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value or ""))[:50]


def store_key(slug: str) -> str:
    return clean_subid(slug).lower()


def build_subids(store_slug: str, channel: str, post: str) -> list[str]:
    ch = CHANNEL_CODE.get(channel, channel)
    return [store_key(store_slug), clean_subid(ch).lower(), clean_subid(post).lower()[:12]]


def parse_utm(utm: str | None) -> tuple[str, str, str]:
    parts = (utm or "").split("-") + ["", "", ""]
    return parts[0].lower(), parts[1].lower(), parts[2].lower()


def channel_from_code(code: str) -> str | None:
    return CODE_CHANNEL.get((code or "").lower())
