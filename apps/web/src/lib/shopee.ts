import "server-only";
import { createHash } from "node:crypto";

/**
 * Shopee Affiliate Open API (Brasil) — GraphQL oficial.
 * Autorização: SHA256(AppId + Timestamp + Payload + Secret).
 * Chaves só em variáveis de ambiente (SHOPEE_APP_ID / SHOPEE_APP_SECRET).
 */
const ENDPOINT = process.env.SHOPEE_API_URL || "https://open-api.affiliate.shopee.com.br/graphql";

export function shopeeConfigured() {
  return Boolean(process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET);
}

export class ShopeeError extends Error {}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_APP_SECRET;
  if (!appId || !secret) throw new ShopeeError("Chaves da Shopee não configuradas (SHOPEE_APP_ID / SHOPEE_APP_SECRET na Vercel).");
  const payload = JSON.stringify({ query, variables });
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = createHash("sha256").update(appId + ts + payload + secret).digest("hex");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${signature}`,
    },
    body: payload,
    cache: "no-store",
  });
  const text = await res.text();
  let json: { data?: T; errors?: { message: string; extensions?: { code?: number; message?: string } }[] };
  try { json = JSON.parse(text); } catch { throw new ShopeeError(`Resposta inválida da Shopee (HTTP ${res.status}): ${text.slice(0, 200)}`); }
  if (json.errors?.length) {
    const e = json.errors[0];
    throw new ShopeeError(`Shopee: ${e.extensions?.message ?? e.message}${e.extensions?.code ? ` (código ${e.extensions.code})` : ""}`);
  }
  if (!json.data) throw new ShopeeError(`Shopee sem dados (HTTP ${res.status}).`);
  return json.data;
}

export const SORT = { relevancia: 1, vendidos: 2, maior_preco: 3, menor_preco: 4, comissao: 5 } as const;
export type SortKey = keyof typeof SORT;

export type ShopeeProduct = {
  itemId: string;
  shopId: string;
  name: string;
  shopName: string | null;
  image: string | null;
  productLink: string;
  offerLink: string | null;
  price: number;
  priceFrom: number | null;
  discountPct: number;
  commissionPct: number;
  commissionValue: number;
  rating: number | null;
  sales: number;
  score: number;
};

type RawNode = {
  itemId: number | string; shopId: number | string; productName: string; shopName?: string;
  imageUrl?: string; productLink: string; offerLink?: string;
  price?: string; priceMin?: string; priceMax?: string; priceDiscountRate?: number;
  commissionRate?: string; ratingStar?: string; sales?: number;
};

const PRODUCT_FIELDS = `itemId shopId productName shopName imageUrl productLink offerLink price priceMin priceMax priceDiscountRate commissionRate ratingStar sales`;

function normalize(n: RawNode): ShopeeProduct {
  const price = Number(n.priceMin ?? n.price ?? 0);
  const discount = Number(n.priceDiscountRate ?? 0);
  const rate = Number(n.commissionRate ?? 0);
  const commissionPct = rate <= 1 ? rate * 100 : rate;
  const rating = n.ratingStar ? Number(n.ratingStar) : null;
  const sales = Number(n.sales ?? 0);
  const commissionValue = price * (commissionPct / 100);
  const score = Math.log10(sales + 10) * commissionValue * (1 + discount / 100) * (rating && rating >= 4.7 ? 1.15 : 1);
  return {
    itemId: String(n.itemId), shopId: String(n.shopId), name: n.productName, shopName: n.shopName ?? null,
    image: n.imageUrl ?? null, productLink: n.productLink, offerLink: n.offerLink ?? null,
    price, priceFrom: discount > 0 && discount < 100 ? Math.round((price / (1 - discount / 100)) * 100) / 100 : null,
    discountPct: discount, commissionPct: Math.round(commissionPct * 100) / 100,
    commissionValue: Math.round(commissionValue * 100) / 100, rating, sales, score,
  };
}

export async function searchProducts(opts: { keyword: string; sort?: SortKey; page?: number; limit?: number }) {
  const data = await gql<{ productOfferV2: { nodes: RawNode[]; pageInfo: { hasNextPage: boolean } } }>(
    `query($keyword: String, $sortType: Int, $page: Int, $limit: Int) {
      productOfferV2(keyword: $keyword, sortType: $sortType, page: $page, limit: $limit) {
        nodes { ${PRODUCT_FIELDS} }
        pageInfo { page limit hasNextPage }
      }
    }`,
    { keyword: opts.keyword, sortType: SORT[opts.sort ?? "vendidos"], page: opts.page ?? 1, limit: Math.min(opts.limit ?? 50, 50) },
  );
  return data.productOfferV2.nodes.map(normalize);
}

export async function getProduct(itemId: string, shopId: string) {
  const data = await gql<{ productOfferV2: { nodes: RawNode[] } }>(
    `query($itemId: Int64, $shopId: Int64) { productOfferV2(itemId: $itemId, shopId: $shopId, limit: 1) { nodes { ${PRODUCT_FIELDS} } } }`,
    { itemId: Number(itemId), shopId: Number(shopId) },
  );
  const n = data.productOfferV2.nodes[0];
  return n ? normalize(n) : null;
}

/** subIds: até 5, só letras e números */
export async function shortLink(originUrl: string, subIds: string[] = []) {
  const clean = subIds.map((s) => s.replace(/[^A-Za-z0-9]/g, "").slice(0, 50)).filter(Boolean).slice(0, 5);
  const data = await gql<{ generateShortLink: { shortLink: string } }>(
    `mutation($input: ShortLinkInput!) { generateShortLink(input: $input) { shortLink } }`,
    { input: { originUrl, subIds: clean } },
  );
  return data.generateShortLink.shortLink;
}

export function pickBest(list: ShopeeProduct[], f: { minPrice?: number; maxPrice?: number; minRating?: number; minSales?: number }, n = 3) {
  const seen = new Set<string>();
  return list
    .filter((p) => (!f.minPrice || p.price >= f.minPrice) && (!f.maxPrice || p.price <= f.maxPrice))
    .filter((p) => p.rating === null ? false : p.rating >= (f.minRating ?? 4.5))
    .filter((p) => p.sales >= (f.minSales ?? 20))
    .sort((a, b) => b.score - a.score)
    .filter((p) => { const k = p.shopId + p.name.slice(0, 25).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n);
}
