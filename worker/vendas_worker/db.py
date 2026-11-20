"""Acesso mínimo ao Supabase via PostgREST com a service role (só no worker, nunca no app web)."""
from __future__ import annotations

from typing import Any

import httpx


class DbError(RuntimeError):
    pass


class Db:
    def __init__(self, url: str, service_key: str, transport: httpx.BaseTransport | None = None):
        self._http = httpx.Client(
            base_url=f"{url}/rest/v1",
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            timeout=20.0,
            transport=transport,
        )

    def _check(self, r: httpx.Response) -> Any:
        if r.status_code >= 400:
            try:
                msg = r.json().get("message") or r.text
            except ValueError:
                msg = r.text
            raise DbError(f"Supabase HTTP {r.status_code}: {msg[:300]}")
        return r.json() if r.content else None

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        return self._check(self._http.get(f"/{table}", params=params)) or []

    def insert(self, table: str, rows: list[dict] | dict, returning: bool = True) -> list[dict[str, Any]]:
        prefer = "return=representation" if returning else "return=minimal"
        return self._check(self._http.post(f"/{table}", json=rows, headers={"Prefer": prefer})) or []

    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        self._check(self._http.post(
            f"/{table}", params={"on_conflict": on_conflict}, json=rows,
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        ))

    def update(self, table: str, filters: dict[str, str], values: dict[str, Any]) -> None:
        self._check(self._http.patch(f"/{table}", params=filters, json=values, headers={"Prefer": "return=minimal"}))

    def rpc(self, fn: str, args: dict[str, Any]) -> Any:
        return self._check(self._http.post(f"/rpc/{fn}", json=args))


def in_list(values) -> str:
    """Filtro PostgREST `in.(...)` com valores entre aspas."""
    return "in.(" + ",".join('"' + str(v).replace('"', "") + '"' for v in values) + ")"
