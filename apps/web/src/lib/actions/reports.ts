"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { dayKey, parseDate, parseMoney } from "@/lib/format";
import type { Platform } from "@/lib/types";
import type { ImportResult } from "@/lib/actions/offers";

type Row = Record<string, string | undefined>;

function mapStatus(s?: string) {
  const v = (s ?? "").toLowerCase();
  if (/cancel|invalid|recus|devol/.test(v)) return "cancelled";
  if (/conclu|complet|pago|aprov|confirm|entreg/.test(v)) return "completed";
  return "pending";
}

function channelFrom(sub?: string) {
  const v = (sub ?? "").toLowerCase();
  if (/wa|whats/.test(v)) return "whatsapp_channel";
  if (/tg|telegram/.test(v)) return "telegram";
  if (/ig|insta/.test(v)) return "instagram";
  if (/tt|tiktok/.test(v)) return "tiktok";
  return null;
}

export async function importConversions(storeId: string, platform: Platform, rows: Row[], filename: string): Promise<ImportResult> {
  const { supabase } = await requireUser();
  const res: ImportResult = { ok: 0, updated: 0, errors: [] };
  const { data: batch } = await supabase.from("import_batches")
    .insert({ store_id: storeId, platform, kind: "conversions", filename }).select("id").single();

  const clean = rows.slice(0, 5000).flatMap((r, i) => {
    if (!r.order_id) { res.errors.push(`Linha ${i + 2}: sem ID do pedido`); return []; }
    return [{
      store_id: storeId, platform,
      order_id: String(r.order_id).trim(),
      item_id: String(r.item_id ?? "").trim(),
      product_title: r.product_title || null,
      sub_id: r.sub_id || null,
      channel_type: channelFrom(r.sub_id),
      ordered_at: parseDate(r.ordered_at),
      order_value: parseMoney(r.order_value),
      commission_value: parseMoney(r.commission_value) ?? 0,
      status: mapStatus(r.status),
      raw: r,
      import_batch_id: batch?.id ?? null,
    }];
  });

  for (let i = 0; i < clean.length; i += 500) {
    const chunk = clean.slice(i, i + 500);
    const { error } = await supabase.from("conversions").upsert(chunk, { onConflict: "store_id,platform,order_id,item_id" });
    if (error) res.errors.push(error.message); else res.ok += chunk.length;
  }
  if (batch) await supabase.from("import_batches").update({ rows_ok: res.ok, rows_err: res.errors.length }).eq("id", batch.id);
  revalidatePath(`/s`, "layout");
  return res;
}

export async function importClicks(storeId: string, platform: Platform, rows: Row[], filename: string): Promise<ImportResult> {
  const { supabase } = await requireUser();
  const res: ImportResult = { ok: 0, updated: 0, errors: [] };
  const agg = new Map<string, { date: string; channel_type: string; clicks: number }>();
  rows.slice(0, 20000).forEach((r, i) => {
    const iso = parseDate(r.date);
    const clicks = parseMoney(r.clicks) ?? (r.clicks === undefined ? 1 : null);
    if (!iso || clicks === null) { res.errors.push(`Linha ${i + 2}: data ou cliques inválidos`); return; }
    const date = dayKey(iso);
    const channel = channelFrom(r.channel) ?? (r.channel || "desconhecido");
    const k = `${date}|${channel}`;
    const cur = agg.get(k) ?? { date, channel_type: channel, clicks: 0 };
    cur.clicks += clicks;
    agg.set(k, cur);
  });
  const upserts = [...agg.values()].map((a) => ({ store_id: storeId, platform, ...a }));
  if (upserts.length) {
    const { error } = await supabase.from("clicks_daily").upsert(upserts, { onConflict: "store_id,platform,channel_type,date" });
    if (error) res.errors.push(error.message); else res.ok = upserts.length;
  }
  await supabase.from("import_batches").insert({ store_id: storeId, platform, kind: "clicks", filename, rows_ok: res.ok, rows_err: res.errors.length });
  revalidatePath(`/s`, "layout");
  return res;
}

export async function addClicksManual(form: FormData) {
  const { supabase } = await requireUser();
  const storeId = String(form.get("store_id"));
  await supabase.from("clicks_daily").upsert({
    store_id: storeId,
    platform: String(form.get("platform")) as Platform,
    channel_type: String(form.get("channel_type") || "desconhecido"),
    date: String(form.get("date")),
    clicks: Number(form.get("clicks") || 0),
  }, { onConflict: "store_id,platform,channel_type,date" });
  revalidatePath(`/s`, "layout");
}
