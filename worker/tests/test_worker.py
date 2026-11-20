import hashlib
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from vendas_worker import conversions, telegram
from vendas_worker.db import Db
from vendas_worker.shopee import ShopeeClient, ShopeeError, normalize_offer, offer_score, sign
from vendas_worker.subids import build_subids, parse_utm


# ------------------------------------------------------------------ Shopee
def test_sign_matches_spec():
    expected = hashlib.sha256(b"123" + b"1700000000" + b'{"query":"{a}"}' + b"sec").hexdigest()
    assert sign("123", 1700000000, '{"query":"{a}"}', "sec") == expected


def make_client(handler):
    return ShopeeClient("app", "sec", "https://x/graphql", transport=httpx.MockTransport(handler),
                        clock=lambda: 1700000000, sleep=lambda _: None)


def test_query_sends_signed_exact_body():
    seen = {}

    def handler(req: httpx.Request):
        seen["body"] = req.content.decode()
        seen["auth"] = req.headers["Authorization"]
        return httpx.Response(200, json={"data": {"ok": 1}})

    assert make_client(handler).query("{ok}") == {"ok": 1}
    assert seen["body"] == '{"query":"{ok}"}'
    assert seen["auth"] == f"SHA256 Credential=app, Timestamp=1700000000, Signature={sign('app', 1700000000, seen['body'], 'sec')}"


def test_graphql_error_raises():
    client = make_client(lambda r: httpx.Response(200, json={"errors": [{"message": "Invalid Signature", "extensions": {"code": 10020}}]}))
    with pytest.raises(ShopeeError, match="10020"):
        client.query("{x}")


def test_retries_5xx_then_ok():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(502) if len(calls) < 3 else httpx.Response(200, json={"data": {"y": 2}})

    assert make_client(handler).query("{y}") == {"y": 2}
    assert len(calls) == 3


def test_keyword_is_escaped_and_sorted_locally():
    seen = {}

    def handler(req):
        seen["q"] = json.loads(req.content)["query"]
        return httpx.Response(200, json={"data": {"productOfferV2": {"nodes": [
            {"itemId": 1, "shopId": 9, "productName": "A", "priceMin": "50", "priceDiscountRate": 10, "sales": 5, "commissionRate": "0.05"},
            {"itemId": 2, "shopId": 9, "productName": "B", "priceMin": "30", "priceDiscountRate": 40, "sales": 1, "commissionRate": "0.03"},
        ], "pageInfo": {"page": 1, "hasNextPage": True}}}})

    res = make_client(handler).product_offers('pano "micro"}', 100, "discount")
    assert 'keyword:"pano \\"micro\\"}"' in seen["q"]
    assert "productCatId:100" in seen["q"] and "sortType:2" in seen["q"]
    assert [i["item_id"] for i in res["items"]] == ["2", "1"]
    assert res["has_next"] is True


def test_normalize_offer():
    o = normalize_offer({"itemId": 22, "shopId": 11, "productName": " Pote ", "priceMin": "60.00",
                         "priceDiscountRate": 40, "sales": 1234, "commissionRate": "0.07", "productLink": "https://shopee.com.br/x"})
    assert o["external_id"] == "11.22"
    assert o["price_to"] == 60.0 and o["price_from"] == 100.0 and o["discount_pct"] == 40.0
    assert o["commission_pct"] == 7.0 and o["sales"] == 1234 and o["title"] == "Pote"
    assert 0 < o["score"] <= 100


def test_score_bounds():
    assert offer_score(None, None, None) == 0
    assert offer_score(90, 100000, 30) == 100


def test_short_link_validates_and_sanitizes():
    seen = {}

    def handler(req):
        seen["q"] = json.loads(req.content)["query"]
        return httpx.Response(200, json={"data": {"generateShortLink": {"shortLink": "https://s.shopee.com.br/abc"}}})

    c = make_client(handler)
    assert c.short_link("https://shopee.com.br/produto-i.1.2", ["achei-pra-casa", "tg", "ab-12"]) == "https://s.shopee.com.br/abc"
    assert 'subIds:["acheipracasa","tg","ab12"]' in seen["q"]
    with pytest.raises(ShopeeError):
        c.short_link("https://evil.com/shopee.com.br", ["a"])


def test_subids_roundtrip():
    subs = build_subids("achei-pra-casa", "telegram", "3f2a9c1e-aaaa")
    assert subs == ["acheipracasa", "tg", "3f2a9c1eaaaa"]
    assert parse_utm("-".join(subs) + "--") == ("acheipracasa", "tg", "3f2a9c1eaaaa")


# --------------------------------------------------------------- fake DB
class FakeDb(Db):
    def __init__(self, tables, rpc_result=None):
        self.tables, self.rpc_result = tables, rpc_result or []
        self.updates, self.upserts, self.inserts = [], [], []

    def select(self, table, params):
        return self.tables.get(table, [])

    def insert(self, table, rows, returning=True):
        self.inserts.append((table, rows))
        return [{"id": "batch1"}]

    def upsert(self, table, rows, on_conflict):
        self.upserts.append((table, rows, on_conflict))

    def update(self, table, filters, values):
        self.updates.append((table, filters, values))

    def rpc(self, fn, args):
        assert fn == "claim_auto_posts"
        return self.rpc_result


# ----------------------------------------------------------- conversions
def test_conversions_run_maps_store_channel_offer():
    nodes = [{"purchaseTime": 1700000000, "utmContent": "acheipracasa-tg-abc--", "conversionId": 7, "orders": [
        {"orderId": "O1", "orderStatus": "COMPLETED", "items": [
            {"shopId": 11, "itemId": 22, "itemName": "Pote", "itemPrice": "10", "qty": 2, "actualAmount": "19.9",
             "itemTotalCommission": "1.4", "displayItemStatus": "Completed"}]}]},
        {"purchaseTime": 1700000000, "utmContent": "outraloja---", "orders": [
            {"orderId": "O2", "orderStatus": "CANCELLED", "items": [{"shopId": 1, "itemId": 2, "itemTotalCommission": "0"}]}]}]

    class Fake:
        def conversion_pages(self, s, e):
            yield nodes

    db = FakeDb({
        "stores": [{"id": "S1", "slug": "achei-pra-casa"}, {"id": "S2", "slug": "outra"}],
        "affiliate_accounts": [{"store_id": "S1"}, {"store_id": "S2"}],
        "products": [{"external_id": "11.22", "offers": [{"id": "OF1", "created_at": "2026-01-01"}]}],
    })
    res = conversions.run(db, Fake(), days=7)
    assert res == {"fetched": 2, "saved": 1, "unmatched": 1, "stores": 1}
    _, rows, conflict = db.upserts[0]
    assert conflict == "store_id,platform,order_id,item_id"
    r = rows[0]
    assert (r["store_id"], r["channel_type"], r["offer_id"], r["status"]) == ("S1", "telegram", "OF1", "completed")
    assert r["order_value"] == 19.9 and r["commission_value"] == 1.4 and r["item_id"] == "22"
    assert "store_key" not in r and "external_id" not in r


# --------------------------------------------------------------- telegram
class FakeBot:
    def __init__(self, result):
        self.result, self.sent = result, []

    def send(self, chat_id, text, photo=None):
        self.sent.append((chat_id, text, photo))
        return self.result


NOW = datetime(2026, 11, 20, 15, 0, tzinfo=timezone.utc)


def tg_db(attempts=1, scheduled=NOW - timedelta(minutes=1), offer_status="active", chat="@canal"):
    return FakeDb({
        "content_items": [{"id": "C1", "body": "Oferta!", "media_url": None,
                           "offers": {"status": offer_status, "products": {"image_url": "https://img/x.jpg"}}}],
        "channels": [{"store_id": "S1", "config": {"chat_id": chat} if chat else {}, "is_active": True}],
    }, rpc_result=[{"id": "P1", "store_id": "S1", "content_item_id": "C1", "scheduled_at": scheduled.isoformat(), "attempts": attempts}])


def test_telegram_posts_and_marks():
    db, bot = tg_db(), FakeBot(telegram.SendResult(True, message_id="99"))
    stats = telegram.run(db, bot, now=NOW)
    assert stats["posted"] == 1
    assert bot.sent == [("@canal", "Oferta!", "https://img/x.jpg")]
    vals = db.updates[0][2]
    assert vals["status"] == "posted" and vals["external_id"] == "99" and vals["locked_at"] is None


def test_telegram_retry_then_fail():
    err = telegram.SendResult(False, error="Telegram 429", retryable=True)
    db = tg_db(attempts=1)
    telegram.run(db, FakeBot(err), max_attempts=3, now=NOW)
    assert db.updates[0][2]["status"] == "pending"
    db = tg_db(attempts=3)
    telegram.run(db, FakeBot(err), max_attempts=3, now=NOW)
    assert db.updates[0][2]["status"] == "failed"


def test_telegram_skips_late_and_inactive_and_no_chat():
    db = tg_db(scheduled=NOW - timedelta(hours=5))
    telegram.run(db, FakeBot(None), max_delay_min=180, now=NOW)
    assert db.updates[0][2]["status"] == "skipped"
    db = tg_db(offer_status="expired")
    telegram.run(db, FakeBot(None), now=NOW)
    assert db.updates[0][2]["status"] == "skipped"
    db = tg_db(chat=None)
    telegram.run(db, FakeBot(None), now=NOW)
    assert db.updates[0][2]["status"] == "failed"


def test_bot_photo_fallback_and_token_not_leaked():
    calls = []

    def handler(req):
        calls.append(req.url.path.rsplit("/", 1)[-1])
        if calls[-1] == "sendPhoto":
            return httpx.Response(400, json={"ok": False, "description": "wrong file"})
        return httpx.Response(200, json={"ok": True, "result": {"message_id": 5}})

    bot = telegram.TelegramBot("SECRET123", transport=httpx.MockTransport(handler))
    assert bot.send("@c", "oi", "https://img").message_id == "5"
    assert calls == ["sendPhoto", "sendMessage"]

    def boom(req):
        raise httpx.ConnectError("conn refused to https://api.telegram.org/botSECRET123/x")

    res = telegram.TelegramBot("SECRET123", transport=httpx.MockTransport(boom)).send("@c", "oi")
    assert res.retryable and "SECRET123" not in res.error
