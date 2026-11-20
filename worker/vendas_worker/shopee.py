"""Cliente da Shopee Affiliate Open API (GraphQL oficial, Brasil). Sem scraping.

Assinatura: Authorization: SHA256 Credential={AppId}, Timestamp={ts}, Signature={sha256(AppId+ts+payload+Secret)}
onde payload é exatamente o corpo JSON enviado.
"""
from __future__ import annotations

import hashlib
import json
import math
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import urlparse

import httpx

from .subids import clean_subid

SHOPEE_HOSTS = ("shopee.com.br", "shp.ee", "s.shopee.com.br")

# productOfferV2.sortType: 1 relevância, 2 vendas, 3 preço ↓, 4 preço ↑, 5 comissão ↓
SORT_TYPES = {"relevance": 1, "sales": 2, "commission": 5}
# ordenados localmente (a API não ordena por desconto/score): busca por vendas e reordena a página
LOCAL_SORTS = {"discount", "score"}


class ShopeeError(RuntimeError):
    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


def sign(app_id: str, timestamp: int, payload: str, secret: str) -> str:
    return hashlib.sha256(f"{app_id}{timestamp}{payload}{secret}".encode("utf-8")).hexdigest()


def gql_str(value: str) -> str:
    """Literal de string GraphQL seguro (mesmas regras de escape do JSON)."""
    return json.dumps(str(value), ensure_ascii=False)


@dataclass
class ShopeeClient:
    app_id: str
    secret: str
    url: str = "https://open-api.affiliate.shopee.com.br/graphql"
    timeout: float = 20.0
    transport: httpx.BaseTransport | None = None
    clock: Callable[[], float] = time.time
    sleep: Callable[[float], None] = time.sleep

    def query(self, document: str) -> dict[str, Any]:
        payload = json.dumps({"query": document}, separators=(",", ":"), ensure_ascii=False)
        ts = int(self.clock())
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"SHA256 Credential={self.app_id}, Timestamp={ts}, "
                             f"Signature={sign(self.app_id, ts, payload, self.secret)}",
        }
        last: Exception | None = None
        for attempt in range(3):
            try:
                with httpx.Client(timeout=self.timeout, transport=self.transport) as http:
                    r = http.post(self.url, content=payload.encode("utf-8"), headers=headers)
            except httpx.HTTPError as e:  # rede
                last = ShopeeError(f"Falha de rede na Shopee: {type(e).__name__}")
                self.sleep(1.5 * (attempt + 1))
                continue
            if r.status_code == 429 or r.status_code >= 500:
                last = ShopeeError(f"Shopee respondeu HTTP {r.status_code}", r.status_code)
                self.sleep(1.5 * (attempt + 1))
                continue
            try:
                body = r.json()
            except ValueError:
                raise ShopeeError(f"Resposta inválida da Shopee (HTTP {r.status_code})", r.status_code)
            if body.get("errors"):
                err = body["errors"][0]
                code = (err.get("extensions") or {}).get("code")
                raise ShopeeError(f"Shopee: {err.get('message', 'erro')}" + (f" (código {code})" if code else ""), code)
            if r.status_code != 200:
                raise ShopeeError(f"Shopee respondeu HTTP {r.status_code}", r.status_code)
            return body.get("data") or {}
        raise last or ShopeeError("Falha ao consultar a Shopee")

    # ---------------------------------------------------------------- ofertas
    def product_offers(self, keyword: str = "", category_id: int | None = None, sort: str = "relevance",
                       page: int = 1, limit: int = 30) -> dict[str, Any]:
        sort_type = SORT_TYPES.get(sort, SORT_TYPES["sales"] if sort in LOCAL_SORTS else 1)
        args = [f"sortType:{sort_type}", f"page:{max(1, int(page))}", f"limit:{min(max(1, int(limit)), 50)}"]
        if keyword.strip():
            args.append(f"keyword:{gql_str(keyword.strip()[:100])}")
        if category_id:
            args.append(f"productCatId:{int(category_id)}")
        doc = (
            "{productOfferV2(" + ",".join(args) + "){"
            "nodes{itemId shopId productName imageUrl priceMin priceMax priceDiscountRate sales ratingStar "
            "commissionRate commission productLink offerLink shopName periodEndTime productCatIds}"
            "pageInfo{page limit hasNextPage}}}"
        )
        data = self.query(doc).get("productOfferV2") or {}
        items = [normalize_offer(n) for n in data.get("nodes") or []]
        if sort == "discount":
            items.sort(key=lambda i: (i["discount_pct"] or 0, i["sales"] or 0), reverse=True)
        elif sort == "score":
            items.sort(key=lambda i: i["score"], reverse=True)
        page_info = data.get("pageInfo") or {}
        return {"items": items, "has_next": bool(page_info.get("hasNextPage")), "page": page_info.get("page", page)}

    # ------------------------------------------------------------- shortlink
    def short_link(self, origin_url: str, sub_ids: list[str]) -> str:
        if not is_shopee_url(origin_url):
            raise ShopeeError("originUrl precisa ser um link da Shopee")
        subs = [s for s in (clean_subid(x) for x in sub_ids) if s][:5]
        doc = (
            "mutation{generateShortLink(input:{originUrl:" + gql_str(origin_url)
            + ",subIds:[" + ",".join(gql_str(s) for s in subs) + "]}){shortLink}}"
        )
        link = ((self.query(doc).get("generateShortLink") or {}).get("shortLink") or "").strip()
        if not link:
            raise ShopeeError("Shopee não devolveu shortLink")
        return link

    # ------------------------------------------------------ conversionReport
    def conversion_pages(self, start_ts: int, end_ts: int, limit: int = 500):
        """Itera páginas do conversionReport. scrollId vale ~30 s e só uma vez: busca em sequência."""
        scroll: str | None = None
        while True:
            args = [f"purchaseTimeStart:{int(start_ts)}", f"purchaseTimeEnd:{int(end_ts)}", f"limit:{min(limit, 500)}"]
            if scroll:
                args.append(f"scrollId:{gql_str(scroll)}")
            doc = (
                "{conversionReport(" + ",".join(args) + "){"
                "nodes{purchaseTime clickTime conversionId utmContent totalCommission "
                "orders{orderId orderStatus items{shopId itemId itemName itemPrice qty actualAmount "
                "itemTotalCommission displayItemStatus completeTime}}}"
                "pageInfo{limit hasNextPage scrollId}}}"
            )
            data = self.query(doc).get("conversionReport") or {}
            yield data.get("nodes") or []
            info = data.get("pageInfo") or {}
            scroll = info.get("scrollId")
            if not info.get("hasNextPage") or not scroll:
                return


# ------------------------------------------------------------------ helpers
def is_shopee_url(url: str) -> bool:
    try:
        u = urlparse(url)
    except ValueError:
        return False
    host = (u.hostname or "").lower()
    return u.scheme in ("http", "https") and any(host == h or host.endswith("." + h) for h in SHOPEE_HOSTS)


def _num(v: Any) -> float | None:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def offer_score(discount_pct: float | None, sales: int | None, commission_pct: float | None) -> float:
    """0–100: 40% desconto (teto 80%), 35% vendas (log, teto 10 mil), 25% comissão (teto 20%)."""
    d = min(max(discount_pct or 0, 0), 80) / 80
    s = min(math.log10((sales or 0) + 1) / 4, 1)
    c = min(max(commission_pct or 0, 0), 20) / 20
    return round((0.40 * d + 0.35 * s + 0.25 * c) * 100, 1)


def normalize_offer(n: dict[str, Any]) -> dict[str, Any]:
    price_to = _num(n.get("priceMin"))
    rate = _num(n.get("priceDiscountRate")) or 0
    rate = rate if 0 < rate < 100 else 0
    price_from = round(price_to / (1 - rate / 100), 2) if price_to and rate else None
    commission_rate = _num(n.get("commissionRate"))
    # commissionRate vem como fração ("0.07"); se vier >1 já é percentual
    commission_pct = None if commission_rate is None else round(commission_rate * 100 if commission_rate <= 1 else commission_rate, 2)
    sales = int(_num(n.get("sales")) or 0)
    discount = float(rate) if rate else None
    return {
        "item_id": str(n.get("itemId") or ""),
        "shop_id": str(n.get("shopId") or ""),
        "external_id": f"{n.get('shopId')}.{n.get('itemId')}",
        "title": (n.get("productName") or "").strip(),
        "image_url": n.get("imageUrl") or None,
        "product_url": n.get("productLink") or None,
        "offer_link": n.get("offerLink") or None,
        "price_to": price_to,
        "price_from": price_from,
        "discount_pct": discount,
        "sales": sales,
        "rating": _num(n.get("ratingStar")),
        "commission_pct": commission_pct,
        "commission_value": _num(n.get("commission")),
        "shop_name": n.get("shopName") or None,
        "category_ids": n.get("productCatIds") or [],
        "period_end": n.get("periodEndTime") or None,
        "score": offer_score(discount, sales, commission_pct),
    }
