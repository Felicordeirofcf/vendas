import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { Brand, ChannelType, Platform } from "@/lib/types";

export function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

export type PublicOffer = {
  id: string; title: string; image_url: string | null; platform: Platform;
  price_from: number | null; price_to: number | null; discount_pct: number | null;
  price_checked_at: string; stale: boolean;
  headline?: string | null; blurb?: string | null; pros?: string | null; cons?: string | null;
};

export type PublicStore = {
  id: string; slug: string; name: string; niche: string | null; brand: Brand;
  tracking: { meta_pixel_id?: string | null; tiktok_pixel_id?: string | null };
  channels: { type: ChannelType; handle: string | null; url: string }[];
  offers: PublicOffer[];
  pages: { slug: string; title: string }[];
};

export type PublicPage = {
  id: string; slug: string; title: string; intro: string | null; outro: string | null;
  updated_at: string; items: PublicOffer[];
};

export const getPublicStore = cache(async (slug: string) => {
  const { data } = await anonClient().rpc("get_public_store", { p_slug: slug });
  return (data ?? null) as PublicStore | null;
});

export const getPublicPage = cache(async (store: string, page: string) => {
  const { data } = await anonClient().rpc("get_public_page", { p_store: store, p_page: page });
  return (data ?? null) as PublicPage | null;
});

/** parâmetros de campanha que seguem do anúncio para o link rastreado */
export function trackingQuery(sp: Record<string, string | string[] | undefined>, extra: Record<string, string> = {}) {
  const q = new URLSearchParams();
  for (const k of ["c", "ch", "utm_source", "utm_medium", "utm_campaign"]) {
    const v = sp[k];
    if (typeof v === "string" && v) q.set(k, v.slice(0, 128));
  }
  if (typeof sp.fbclid === "string") q.set("fb", "1");
  if (typeof sp.ttclid === "string") q.set("tt", "1");
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}
