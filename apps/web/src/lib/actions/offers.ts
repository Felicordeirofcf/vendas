"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { parseMoney } from "@/lib/format";
import type { OfferStatus, Platform } from "@/lib/types";

export type OfferRow = {
  affiliate_url: string;
  title: string;
  price_from?: string | number | null;
  price_to?: string | number | null;
  commission_pct?: string | number | null;
  external_id?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  category?: string | null;
};

export type ImportResult = { ok: number; updated: number; errors: string[] };

function shopeeItemId(url?: string | null) {
  const m = url?.match(/i\.(\d+)\.(\d+)/) ?? url?.match(/product\/(\d+)\/(\d+)/);
  return m ? `${m[1]}.${m[2]}` : null;
}

async function upsertOffers(storeId: string, platform: Platform, rows: OfferRow[], source: "manual" | "csv"): Promise<ImportResult> {
  const { supabase } = await requireUser();
  const res: ImportResult = { ok: 0, updated: 0, errors: [] };

  for (const [i, r] of rows.entries()) {
    const url = String(r.affiliate_url ?? "").trim();
    const title = String(r.title ?? "").trim();
    if (!/^https?:\/\//i.test(url)) { res.errors.push(`Linha ${i + 1}: link inválido`); continue; }
    if (!title) { res.errors.push(`Linha ${i + 1}: falta o título`); continue; }
    if (platform === "mercadolivre" && !/mercadoli[bv]re|meli\.la|mlb/i.test(url)) {
      res.errors.push(`Linha ${i + 1}: não parece um link do Mercado Livre`); continue;
    }
    const priceFrom = parseMoney(r.price_from);
    const priceTo = parseMoney(r.price_to);
    const commission = parseMoney(r.commission_pct);
    const externalId = (r.external_id ? String(r.external_id).trim() : null) || (platform === "shopee" ? shopeeItemId(r.product_url ?? url) : null);

    const { data: existing } = await supabase.from("offers").select("id, product_id")
      .eq("store_id", storeId).eq("affiliate_url", url).maybeSingle();

    if (existing) {
      const { error } = await supabase.from("offers").update({
        price_from: priceFrom, price_to: priceTo, commission_pct: commission,
        price_checked_at: new Date().toISOString(), status: "active",
      }).eq("id", existing.id);
      if (error) res.errors.push(`Linha ${i + 1}: ${error.message}`);
      else {
        await supabase.from("price_snapshots").insert({ store_id: storeId, offer_id: existing.id, price_from: priceFrom, price_to: priceTo });
        res.updated++;
      }
      continue;
    }

    let productId: string | null = null;
    if (externalId) {
      const { data } = await supabase.from("products").select("id")
        .eq("store_id", storeId).eq("platform", platform).eq("external_id", externalId).maybeSingle();
      productId = data?.id ?? null;
    }
    if (!productId) {
      const { data, error } = await supabase.from("products").insert({
        store_id: storeId, platform, external_id: externalId, title,
        image_url: r.image_url || null, product_url: r.product_url || null, category: r.category || null,
      }).select("id").single();
      if (error) { res.errors.push(`Linha ${i + 1}: ${error.message}`); continue; }
      productId = data.id;
    }
    const { data: offer, error } = await supabase.from("offers").insert({
      store_id: storeId, product_id: productId, affiliate_url: url,
      price_from: priceFrom, price_to: priceTo, commission_pct: commission, source,
    }).select("id").single();
    if (error) { res.errors.push(`Linha ${i + 1}: ${error.message}`); continue; }
    await supabase.from("price_snapshots").insert({ store_id: storeId, offer_id: offer.id, price_from: priceFrom, price_to: priceTo });
    res.ok++;
  }

  await supabase.from("import_batches").insert({
    store_id: storeId, platform, kind: "links", rows_ok: res.ok + res.updated, rows_err: res.errors.length,
  });
  revalidatePath(`/s`, "layout");
  return res;
}

export async function importOfferRows(storeId: string, platform: Platform, rows: OfferRow[]) {
  return upsertOffers(storeId, platform, rows.slice(0, 2000), "csv");
}

/** Colar: uma oferta por linha → link | título | preço de | preço por | comissão % */
export async function importPasted(_: ImportResult | null, form: FormData): Promise<ImportResult> {
  const storeId = String(form.get("store_id"));
  const platform = String(form.get("platform")) as Platform;
  const lines = String(form.get("lines") ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: OfferRow[] = lines.map((l) => {
    const [affiliate_url, title, price_from, price_to, commission_pct] = l.split(/\s*[|;\t]\s*/);
    return { affiliate_url, title, price_from, price_to, commission_pct };
  });
  return upsertOffers(storeId, platform, rows, "manual");
}

export async function createOffer(_: ImportResult | null, form: FormData): Promise<ImportResult> {
  const storeId = String(form.get("store_id"));
  const platform = String(form.get("platform")) as Platform;
  return upsertOffers(storeId, platform, [{
    affiliate_url: String(form.get("affiliate_url") ?? ""),
    title: String(form.get("title") ?? ""),
    price_from: String(form.get("price_from") ?? ""),
    price_to: String(form.get("price_to") ?? ""),
    commission_pct: String(form.get("commission_pct") ?? ""),
    image_url: String(form.get("image_url") ?? "") || null,
    product_url: String(form.get("product_url") ?? "") || null,
  }], "manual");
}

export async function verifyPrice(form: FormData) {
  const { supabase } = await requireUser();
  const id = String(form.get("id"));
  const storeId = String(form.get("store_id"));
  const priceFrom = parseMoney(form.get("price_from"));
  const priceTo = parseMoney(form.get("price_to"));
  await supabase.from("offers").update({
    price_from: priceFrom, price_to: priceTo, price_checked_at: new Date().toISOString(), status: "active",
  }).eq("id", id);
  await supabase.from("price_snapshots").insert({ store_id: storeId, offer_id: id, price_from: priceFrom, price_to: priceTo });
  revalidatePath(`/s`, "layout");
}

export async function setOfferStatus(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("offers").update({ status: String(form.get("status")) as OfferStatus }).eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}

export async function deleteOffer(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("offers").delete().eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}
