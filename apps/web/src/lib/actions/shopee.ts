"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { getProduct, pickBest, searchProducts, shopeeConfigured, ShopeeError, shortLink, type ShopeeProduct, type SortKey } from "@/lib/shopee";

export type SearchState = { items?: ShopeeProduct[]; error?: string; keyword?: string };

export async function searchShopee(_: SearchState, form: FormData): Promise<SearchState> {
  await requireUser();
  const keyword = String(form.get("keyword") ?? "").trim();
  if (!keyword) return { error: "Digite uma palavra-chave." };
  try {
    const raw = await searchProducts({ keyword, sort: String(form.get("sort") || "vendidos") as SortKey, limit: 50 });
    const min = Number(form.get("min_price") || 0), max = Number(form.get("max_price") || 0);
    const minRating = Number(form.get("min_rating") || 0);
    const items = raw
      .filter((p) => (!min || p.price >= min) && (!max || p.price <= max) && (!minRating || (p.rating ?? 0) >= minRating))
      .sort((a, b) => b.score - a.score);
    return { items, keyword };
  } catch (e) {
    return { error: e instanceof ShopeeError ? e.message : `Falha ao consultar a Shopee: ${(e as Error).message}` };
  }
}

async function importOne(storeId: string, storeSlug: string, p: ShopeeProduct, pageId?: string | null, pageSlug?: string) {
  const { supabase } = await requireUser();
  const affiliate = await shortLink(p.productLink, [storeSlug, "vitrine", pageSlug ?? "catalogo"]).catch(() => p.offerLink);
  if (!affiliate) throw new ShopeeError(`Sem link de afiliado para ${p.name}`);
  const externalId = `${p.shopId}.${p.itemId}`;

  let { data: product } = await supabase.from("products").select("id").eq("store_id", storeId).eq("platform", "shopee").eq("external_id", externalId).maybeSingle();
  if (!product) {
    const ins = await supabase.from("products").insert({
      store_id: storeId, platform: "shopee", external_id: externalId, title: p.name.slice(0, 200),
      image_url: p.image, product_url: p.productLink,
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    product = ins.data;
  }
  const fields = {
    affiliate_url: affiliate, price_from: p.priceFrom, price_to: p.price, commission_pct: p.commissionPct,
    status: "active" as const, source: "shopee_api" as const, price_checked_at: new Date().toISOString(),
    score: Math.round(p.score * 100) / 100,
  };
  const { data: existing } = await supabase.from("offers").select("id").eq("store_id", storeId).eq("product_id", product.id).maybeSingle();
  let offerId = existing?.id as string | undefined;
  if (offerId) await supabase.from("offers").update(fields).eq("id", offerId);
  else {
    const ins = await supabase.from("offers").insert({ store_id: storeId, product_id: product.id, ...fields }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    offerId = ins.data.id;
  }
  await supabase.from("price_snapshots").insert({ store_id: storeId, offer_id: offerId, price_from: p.priceFrom, price_to: p.price });
  if (pageId) {
    const { count } = await supabase.from("landing_page_items").select("id", { count: "exact", head: true }).eq("page_id", pageId);
    await supabase.from("landing_page_items").upsert(
      { store_id: storeId, page_id: pageId, offer_id: offerId, position: (count ?? 0) + 1 },
      { onConflict: "page_id,offer_id", ignoreDuplicates: true },
    );
  }
  return offerId;
}

export async function importShopee(storeId: string, storeSlug: string, items: ShopeeProduct[], pageId?: string | null) {
  const { supabase } = await requireUser();
  let pageSlug: string | undefined;
  if (pageId) pageSlug = (await supabase.from("landing_pages").select("slug").eq("id", pageId).maybeSingle()).data?.slug;
  const errors: string[] = [];
  let ok = 0;
  for (const p of items.slice(0, 30)) {
    try { await importOne(storeId, storeSlug, p, pageId, pageSlug); ok++; } catch (e) { errors.push(`${p.name.slice(0, 40)}: ${(e as Error).message}`); }
  }
  await supabase.from("import_batches").insert({ store_id: storeId, platform: "shopee", kind: "links", filename: "shopee_api", rows_ok: ok, rows_err: errors.length });
  revalidatePath("/", "layout");
  return { ok, updated: 0, errors };
}

/** Busca e preenche automaticamente as páginas de campanha com os 3 melhores produtos de cada uma */
const PAGE_PLAN: Record<string, { keywords: string[]; minPrice: number; maxPrice: number }> = {
  "air-fryer": { keywords: ["air fryer", "fritadeira elétrica sem óleo"], minPrice: 150, maxPrice: 1200 },
  "robo-aspirador": { keywords: ["robô aspirador", "robo aspirador inteligente"], minPrice: 250, maxPrice: 3000 },
  "cafeteira-espresso": { keywords: ["cafeteira espresso", "cafeteira expresso 20 bar"], minPrice: 200, maxPrice: 2500 },
  "panela-de-pressao-eletrica": { keywords: ["panela de pressão elétrica"], minPrice: 180, maxPrice: 1000 },
  "aspirador-vertical-sem-fio": { keywords: ["aspirador vertical sem fio", "aspirador de pó sem fio"], minPrice: 150, maxPrice: 2000 },
};

export type FillResult = { pages: { slug: string; added: number; note?: string }[]; error?: string };

export async function fillPagesFromShopee(_: FillResult | null, form: FormData): Promise<FillResult> {
  const { supabase } = await requireUser();
  if (!shopeeConfigured()) return { pages: [], error: "Cadastre SHOPEE_APP_ID e SHOPEE_APP_SECRET na Vercel e faça redeploy." };
  const storeId = String(form.get("store_id"));
  const storeSlug = String(form.get("store_slug"));
  const perPage = Math.min(6, Math.max(1, Number(form.get("per_page") || 3)));
  const { data: pages } = await supabase.from("landing_pages").select("id, slug").eq("store_id", storeId);
  const result: FillResult = { pages: [] };

  for (const pg of pages ?? []) {
    const plan = PAGE_PLAN[pg.slug];
    if (!plan) { result.pages.push({ slug: pg.slug, added: 0, note: "sem plano de busca (adicione manualmente)" }); continue; }
    try {
      const found: ShopeeProduct[] = [];
      for (const kw of plan.keywords) found.push(...await searchProducts({ keyword: kw, sort: "vendidos", limit: 50 }));
      let best = pickBest(found, { minPrice: plan.minPrice, maxPrice: plan.maxPrice, minRating: 4.6, minSales: 50 }, perPage);
      if (best.length < perPage) best = pickBest(found, { minPrice: plan.minPrice, maxPrice: plan.maxPrice, minRating: 4.3, minSales: 5 }, perPage);
      let added = 0;
      for (const p of best) { await importOne(storeId, storeSlug, p, pg.id, pg.slug); added++; }
      await supabase.from("landing_pages").update({ updated_at: new Date().toISOString() }).eq("id", pg.id);
      result.pages.push({ slug: pg.slug, added, note: best.length ? undefined : "nenhum produto passou nos filtros" });
    } catch (e) {
      result.pages.push({ slug: pg.slug, added: 0, note: (e as Error).message });
    }
  }
  revalidatePath("/", "layout");
  return result;
}

/** Atualiza preço/comissão das ofertas Shopee ativas */
export async function refreshShopeePrices(_: { ok?: number; errors?: string[] } | null, form: FormData) {
  const { supabase } = await requireUser();
  const storeId = String(form.get("store_id"));
  const { data } = await supabase.from("offers").select("id, products!inner(external_id, platform)").eq("store_id", storeId)
    .eq("status", "active").eq("products.platform", "shopee").limit(200);
  let ok = 0; const errors: string[] = [];
  for (const o of (data ?? []) as unknown as { id: string; products: { external_id: string | null } }[]) {
    const [shopId, itemId] = (o.products.external_id ?? "").split(".");
    if (!shopId || !itemId) continue;
    try {
      const p = await getProduct(itemId, shopId);
      if (!p) { await supabase.from("offers").update({ status: "expired" }).eq("id", o.id); continue; }
      await supabase.from("offers").update({ price_from: p.priceFrom, price_to: p.price, commission_pct: p.commissionPct, price_checked_at: new Date().toISOString() }).eq("id", o.id);
      await supabase.from("price_snapshots").insert({ store_id: storeId, offer_id: o.id, price_from: p.priceFrom, price_to: p.price });
      ok++;
    } catch (e) { errors.push((e as Error).message); if (errors.length > 3) break; }
  }
  revalidatePath("/", "layout");
  return { ok, errors };
}

export async function testShopee() {
  await requireUser();
  try {
    const r = await searchProducts({ keyword: "air fryer", limit: 1 });
    return { ok: true, message: r.length ? `Conectado ✓ (ex.: ${r[0].name.slice(0, 40)}…)` : "Conectado ✓ (busca sem resultados)" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
