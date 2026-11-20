import os

os.environ.update({"WORKER_TOKEN": "t0k", "RUN_SCHEDULER": "false", "SHOPEE_APP_ID": "a", "SHOPEE_APP_SECRET": "s"})

from fastapi.testclient import TestClient  # noqa: E402

from vendas_worker import app as appmod  # noqa: E402


def test_auth_and_routes(monkeypatch):
    class Fake:
        def product_offers(self, *a):
            return {"items": [], "has_next": False, "page": 1}

        def short_link(self, url, subs):
            return "https://s.shopee.com.br/x"

    monkeypatch.setattr(appmod, "shopee_client", lambda: Fake())
    with TestClient(appmod.app) as c:
        assert c.get("/health").json() == {"ok": True}
        assert c.get("/shopee/offers").status_code == 401
        assert c.get("/shopee/offers", headers={"Authorization": "Bearer errado"}).status_code == 401
        h = {"Authorization": "Bearer t0k"}
        assert c.get("/shopee/offers?sort=score&keyword=pote", headers=h).json()["items"] == []
        assert c.get("/shopee/offers?sort=drop", headers=h).status_code == 422
        r = c.post("/shopee/shortlink", headers=h, json={"origin_url": "https://shopee.com.br/x", "sub_ids": ["a", "b"]})
        assert r.json() == {"short_link": "https://s.shopee.com.br/x"}
        assert c.post("/jobs/nada", headers=h).status_code == 404
