export type Platform = "shopee" | "mercadolivre";
export type ChannelType = "instagram" | "tiktok" | "whatsapp_channel" | "telegram";
export type OfferStatus = "draft" | "active" | "paused" | "expired";
export type ContentKind = "whatsapp" | "caption_instagram" | "caption_tiktok" | "telegram" | "reel";
export type PostStatus = "pending" | "posted" | "skipped" | "failed";

export type Brand = {
  primary?: string;
  secondary?: string;
  dark?: string;
  icon?: string;
  hashtags?: string[];
  bio_cta?: string;
  emoji?: string;
};

export type Tracking = {
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  conv_estimate_pct?: number | null;
  custom_domain?: string | null;
};

export type Store = {
  id: string;
  slug: string;
  name: string;
  niche: string | null;
  status: string;
  brand: Brand;
  timezone: string;
  is_public: boolean;
  tracking: Tracking;
};

export type Product = {
  id: string;
  platform: Platform;
  external_id: string | null;
  title: string;
  category: string | null;
  image_url: string | null;
  product_url: string | null;
};

export type Offer = {
  id: string;
  store_id: string;
  product_id: string;
  affiliate_url: string;
  price_from: number | null;
  price_to: number | null;
  discount_pct: number | null;
  commission_pct: number | null;
  status: OfferStatus;
  source: string;
  price_checked_at: string;
  notes: string | null;
  created_at: string;
  products: Product;
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
};

export const CHANNEL_LABEL: Record<string, string> = {
  vitrine: "Vitrine",
  meta: "Anúncio Meta",
  pinterest: "Pinterest",
  google: "Google",
  whatsapp_channel: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export const KIND_LABEL: Record<ContentKind, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  caption_instagram: "Legenda Instagram",
  caption_tiktok: "Legenda TikTok",
  reel: "Reel",
};

export const KIND_CHANNEL: Record<Exclude<ContentKind, "reel">, ChannelType> = {
  whatsapp: "whatsapp_channel",
  telegram: "telegram",
  caption_instagram: "instagram",
  caption_tiktok: "tiktok",
};

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  expired: "Expirada",
};

/** Horas sem verificação até o preço ser considerado vencido */
export const STALE_HOURS: Record<Platform, number> = { mercadolivre: 24, shopee: 6 };
