"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { localToIso } from "@/lib/format";
import { KIND_CHANNEL, type ContentKind, type PostStatus } from "@/lib/types";

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
    const { error: e2 } = await supabase.from("scheduled_posts").insert({
      store_id: storeId,
      content_item_id: item.id,
      channel_type: KIND_CHANNEL[kind],
      scheduled_at: localToIso(when),
      mode: kind === "telegram" && form.get("auto") ? "auto" : "manual",
    });
    if (e2) return { error: e2.message };
    revalidatePath(`/s`, "layout");
    return { ok: "Agendado ✓" };
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
  await supabase.from("scheduled_posts").update({ scheduled_at: localToIso(when), status: "pending" }).eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}

export async function deletePost(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("scheduled_posts").delete().eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}
