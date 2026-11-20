"""Importação agendada do conversionReport da Shopee → tabela conversions."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from .db import Db, in_list
from .shopee import ShopeeClient, _num
from .subids import channel_from_code, parse_utm, store_key

log = logging.getLogger(__name__)


def map_status(item_status: str | None, order_status: str | None) -> str:
    v = f"{item_status or ''} {order_status or ''}".lower()
    if any(k in v for k in ("cancel", "invalid", "fail", "refund", "return")):
        return "cancelled"
    if "complet" in v:
        return "completed"
    return "pending"


def _iso(ts: Any) -> str | None:
    n = _num(ts)
    return datetime.fromtimestamp(n, tz=timezone.utc).isoformat() if n else None


def flatten(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Um registro por item de pedido (mesma granularidade do import por CSV)."""
    out = []
    for node in nodes:
        sub_store, sub_channel, _sub_post = parse_utm(node.get("utmContent"))
        for order in node.get("orders") or []:
            for item in order.get("items") or []:
                qty = _num(item.get("qty")) or 1
                price = _num(item.get("itemPrice"))
                value = _num(item.get("actualAmount"))
                if value is None and price is not None:
                    value = price * qty
                out.append({
                    "store_key": sub_store,
                    "order_id": str(order.get("orderId") or ""),
                    "item_id": str(item.get("itemId") or ""),
                    "external_id": f"{item.get('shopId')}.{item.get('itemId')}",
                    "sub_id": node.get("utmContent") or None,
                    "channel_type": channel_from_code(sub_channel),
                    "product_title": item.get("itemName") or None,
                    "ordered_at": _iso(node.get("purchaseTime")),
                    "order_value": round(value, 2) if value is not None else None,
                    "commission_value": round(_num(item.get("itemTotalCommission")) or 0, 2),
                    "status": map_status(item.get("displayItemStatus"), order.get("orderStatus")),
                    "raw": {"conversionId": node.get("conversionId"), "order": {k: v for k, v in order.items() if k != "items"}, "item": item},
                })
    return [r for r in out if r["order_id"]]


def resolve_store(stores: list[dict], shopee_store_ids: set[str], default_slug: str):
    by_key = {store_key(s["slug"]): s["id"] for s in stores}
    fallback = None
    if default_slug:
        fallback = next((s["id"] for s in stores if s["slug"] == default_slug), None)
    elif len(shopee_store_ids) == 1:
        fallback = next(iter(shopee_store_ids))
    return lambda key: by_key.get(key) or fallback


def run(db: Db, shopee: ShopeeClient, days: int = 30, default_slug: str = "", now: float | None = None) -> dict[str, int]:
    end = int(now or time.time())
    start = end - days * 86400
    rows: list[dict[str, Any]] = []
    for page in shopee.conversion_pages(start, end):
        rows.extend(flatten(page))

    stores = db.select("stores", {"select": "id,slug"})
    accounts = db.select("affiliate_accounts", {"select": "store_id", "platform": "eq.shopee"})
    store_of = resolve_store(stores, {a["store_id"] for a in accounts}, default_slug)

    per_store: dict[str, list[dict]] = {}
    unmatched = 0
    for r in rows:
        sid = store_of(r.pop("store_key"))
        if not sid:
            unmatched += 1
            continue
        per_store.setdefault(sid, []).append(r)

    total = 0
    for sid, items in per_store.items():
        offer_of = _offer_lookup(db, sid, {r["external_id"] for r in items})
        batch = db.insert("import_batches", {
            "store_id": sid, "platform": "shopee", "kind": "conversions", "filename": "shopee_api:conversionReport",
        })
        batch_id = batch[0]["id"] if batch else None
        by_key: dict[tuple[str, str], dict] = {}  # item repetido no relatório: fica o último
        for r in items:
            ext = r.pop("external_id")
            by_key[(r["order_id"], r["item_id"])] = {
                **r, "store_id": sid, "platform": "shopee", "offer_id": offer_of.get(ext), "import_batch_id": batch_id,
            }
        clean = list(by_key.values())
        for i in range(0, len(clean), 500):
            db.upsert("conversions", clean[i:i + 500], "store_id,platform,order_id,item_id")
        if batch_id:
            db.update("import_batches", {"id": f"eq.{batch_id}"}, {"rows_ok": len(clean)})
        total += len(clean)

    result = {"fetched": len(rows), "saved": total, "unmatched": unmatched, "stores": len(per_store)}
    log.info("conversionReport: %s", result)
    return result


def _offer_lookup(db: Db, store_id: str, external_ids: set[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    ids = sorted(e for e in external_ids if e and "None" not in e)
    for i in range(0, len(ids), 100):
        prods = db.select("products", {
            "select": "external_id,offers(id,created_at)",
            "store_id": f"eq.{store_id}", "platform": "eq.shopee", "external_id": in_list(ids[i:i + 100]),
        })
        for p in prods:
            offers = sorted(p.get("offers") or [], key=lambda o: o["created_at"], reverse=True)
            if offers:
                found[p["external_id"]] = offers[0]["id"]
    return found
