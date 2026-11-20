"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { localToIso } from "@/lib/format";
import { CHANNEL_SUBID, KIND_CHANNEL, type ChannelType, type ContentKind, type PostStatus } from "@/lib/types";
import { shopeeShortLink, workerConfigured } from "@/lib/worker";

export type SaveState = { ok?: string; error?: string };

export async function saveContent(_: SaveState, form: FormData): Promise<SaveState> {
  const { supabase } = await requireUser();
  const storeId = String(form.get("store_id"));
  const offerId = String(form.get("offer_id") || "") || null;
  const kind = String(form.get("kind")) as Exclude<ContentKind, "reel">;
  const body = String(form.get("body") ?? "").trim();
  const when = String(form.get("scheduled_at") ?? "");
  if (!body) return { error: "Texto vazio." };
  if ((kind === "caption_instagram" || kind === "caption_tiktok") && !/#publi\b/i.test(body)) {
    return { error: "Inclua #publi na legenda antes de salvar." };
  }

  const { data: item, error } = await supabase.from("content_items")
    .insert({ store_id: storeId, offer_id: offerId, kind, body }).select("id").single();
  if (error) return { error: error.message };

  if (when) {
    const channel = KIND_CHANNEL[kind];
    const { data: post, error: e2 } = await supabase.from("scheduled_posts").insert({
      store_id: storeId,
      content_item_id: item.id,
      channel_type: channel,
      scheduled_at: localToIso(when),
      mode: kind === "telegram" && form.get("auto") ? "auto" : "manual",
    }).select("id").single();
    if (e2) return { error: e2.message };
    const note = offerId ? await tagShopeeLink(supabase, storeId, offerId, item.id, body, channel, post.id) : "";
    revalidatePath(`/s`, "layout");
    return { ok: `Agendado ✓${note}` };
  }
  revalidatePath(`/s`, "layout");
  return { ok: "Salvo ✓" };
}

export async function setPostStatus(form: FormData) {
  const { supabase } = await requireUser();
  const status = String(form.get("status")) as PostStatus;
  await supabase.from("scheduled_posts").update({
    status, posted_at: status === "posted" ? new Date().toISOString() : null,
  }).eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}

export async function reschedulePost(form: FormData) {
  const { supabase } = await requireUser();
  const when = String(form.get("scheduled_at") ?? "");
  if (!when) return;
  await supabase.from("scheduled_posts").update({
    scheduled_at: localToIso(when), status: "pending", attempts: 0, locked_at: null, error: null,
  }).eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}

export async function deletePost(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("scheduled_posts").delete().eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}

type Sb = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Shopee: troca o link base pelo shortlink com subIds loja|canal|post (atribuição por post). */
async function tagShopeeLink(supabase: Sb, storeId: string, offerId: string, itemId: string, body: string, channel: ChannelType, postId: string) {
  if (!workerConfigured()) return "";
  const [{ data: offer }, { data: store }] = await Promise.all([
    supabase.from("offers").select("affiliate_url, products(platform, product_url)").eq("id", offerId).maybeSingle(),
    supabase.from("stores").select("slug").eq("id", storeId).maybeSingle(),
  ]);
  const prod = offer?.products as unknown as { platform: string; product_url: string | null } | null;
  if (!offer || !store || prod?.platform !== "shopee" || !prod.product_url || !body.includes(offer.affiliate_url)) return "";
  try {
    const link = await shopeeShortLink(prod.product_url, [store.slug, CHANNEL_SUBID[channel], postId.replace(/-/g, "").slice(0, 12)]);
    const { error } = await supabase.from("content_items").update({ body: body.split(offer.affiliate_url).join(link) }).eq("id", itemId);
    return error ? " (link sem rastreio por post)" : " · link rastreado por post";
  } catch {
    return " (link sem rastreio por post)";
  }
}
