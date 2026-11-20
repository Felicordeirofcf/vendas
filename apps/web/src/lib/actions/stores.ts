"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { slugify } from "@/lib/format";
import type { ChannelType } from "@/lib/types";

const CHANNELS: ChannelType[] = ["instagram", "tiktok", "whatsapp_channel", "telegram"];

function brandFrom(form: FormData) {
  const tags = String(form.get("hashtags") ?? "").split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
  return {
    primary: String(form.get("primary") || "#FF6B35"),
    secondary: String(form.get("secondary") || "#FFD23F"),
    dark: String(form.get("dark") || "#2B2B2B"),
    emoji: String(form.get("emoji") || "🏠"),
    bio_cta: String(form.get("bio_cta") || ""),
    hashtags: tags,
  };
}

export type StoreState = { error?: string; ok?: boolean };

export async function saveStore(_: StoreState, form: FormData): Promise<StoreState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const slug = slugify(String(form.get("slug") || name));
  if (!name || !slug) return { error: "Informe o nome da loja." };

  const conv = Number(String(form.get("conv_estimate_pct") ?? "").replace(",", "."));
  const pixel = (k: string) => String(form.get(k) ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "") || null;
  const row = {
    name, slug, niche: String(form.get("niche") ?? "") || null, brand: brandFrom(form),
    is_public: form.get("is_public") === "on",
    tracking: {
      meta_pixel_id: pixel("meta_pixel_id"),
      tiktok_pixel_id: pixel("tiktok_pixel_id"),
      conv_estimate_pct: Number.isFinite(conv) && conv > 0 ? conv : 2,
      custom_domain: String(form.get("custom_domain") ?? "").trim().toLowerCase() || null,
    },
  };
  let storeId = id;
  if (id) {
    const { error } = await supabase.from("stores").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("stores").insert(row).select("id").single();
    if (error) return { error: error.code === "23505" ? "Já existe uma loja com esse endereço (slug)." : error.message };
    storeId = data.id;
  }

  const channels = CHANNELS.map((type) => ({
    store_id: storeId,
    type,
    handle: String(form.get(`${type}_handle`) ?? "") || null,
    url: String(form.get(`${type}_url`) ?? "") || null,
    account_type: String(form.get(`${type}_account`) ?? "") || null,
  })).filter((c) => c.handle || c.url);
  if (channels.length) {
    const { error } = await supabase.from("channels").upsert(channels, { onConflict: "store_id,type" });
    if (error) return { error: error.message };
  }

  const accounts = (["shopee", "mercadolivre"] as const)
    .map((platform) => ({ store_id: storeId, platform, label: String(form.get(`${platform}_label`) ?? "").trim() }))
    .filter((a) => a.label);
  if (accounts.length) {
    const { error } = await supabase.from("affiliate_accounts").upsert(accounts, { onConflict: "store_id,platform" });
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");
  if (!id) redirect(`/s/${slug}`);
  if (slug !== String(form.get("current_slug"))) redirect(`/s/${slug}/config`);
  return { ok: true };
}
