import "server-only";
import type { ShopeeItem } from "@/lib/types";

// Só no servidor (Vercel). O token protege o worker do Render; nunca vai para o navegador.
const WORKER_URL = (process.env.WORKER_URL ?? "").replace(/\/+$/, "");
const WORKER_TOKEN = process.env.WORKER_TOKEN ?? "";

export function workerConfigured() {
  return Boolean(WORKER_URL && WORKER_TOKEN);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!workerConfigured()) throw new Error("Worker não configurado (WORKER_URL / WORKER_TOKEN).");
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${WORKER_TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : `Worker respondeu HTTP ${res.status}`);
  return body as T;
}

export type ShopeeSort = "score" | "discount" | "sales" | "commission" | "relevance";

export function searchShopeeOffers(p: { keyword?: string; category?: number; sort: ShopeeSort; page: number }) {
  const qs = new URLSearchParams({ sort: p.sort, page: String(p.page), limit: "30" });
  if (p.keyword) qs.set("keyword", p.keyword);
  if (p.category) qs.set("category", String(p.category));
  return call<{ items: ShopeeItem[]; has_next: boolean; page: number }>(`/shopee/offers?${qs}`);
}

/** subIds = loja|canal|post (o worker deixa só letras e números) */
export async function shopeeShortLink(originUrl: string, subIds: string[]) {
  const { short_link } = await call<{ short_link: string }>("/shopee/shortlink", {
    method: "POST",
    body: JSON.stringify({ origin_url: originUrl, sub_ids: subIds.slice(0, 5) }),
  });
  return short_link;
}
