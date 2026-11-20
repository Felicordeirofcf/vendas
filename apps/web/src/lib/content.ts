import { brl, dateTime } from "@/lib/format";
import type { Brand, ContentKind, Offer, Store } from "@/lib/types";

const HOOKS = [
  "Achadinho que salva a rotina",
  "Você precisa ver esse preço",
  "Corre que baixou",
  "O queridinho da cozinha tá em promoção",
  "Organização sem gastar muito",
  "Achei e já vou te mostrar",
];

const DEFAULT_TAGS = ["achadinhos", "promoção", "oferta"];

export type ContentInput = {
  store: Pick<Store, "name" | "brand">;
  offer: Pick<Offer, "affiliate_url" | "price_from" | "price_to" | "discount_pct" | "price_checked_at"> & {
    products: { title: string };
  };
  variant?: number;
};

function hook(variant = 0) {
  return HOOKS[((variant % HOOKS.length) + HOOKS.length) % HOOKS.length];
}

function tags(brand: Brand, extra: string[] = []) {
  const list = [...(brand.hashtags?.length ? brand.hashtags : DEFAULT_TAGS), ...extra];
  return Array.from(new Set(["publi", ...list.map((t) => t.replace(/^#/, "").trim()).filter(Boolean)]))
    .map((t) => `#${t}`)
    .join(" ");
}

function priceLines(o: ContentInput["offer"], fmt: "wa" | "plain") {
  const off = o.discount_pct ? ` (${Math.round(Number(o.discount_pct))}% OFF)` : "";
  const lines: string[] = [];
  if (o.price_from && o.price_to && Number(o.price_from) > Number(o.price_to)) {
    lines.push(fmt === "wa" ? `~De ${brl(o.price_from)}~` : `De ${brl(o.price_from)}`);
  }
  if (o.price_to) lines.push(fmt === "wa" ? `*Por ${brl(o.price_to)}*${off} 🔥` : `Por ${brl(o.price_to)}${off} 🔥`);
  return lines;
}

export function whatsappMessage({ store, offer, variant }: ContentInput) {
  const e = store.brand.emoji || "🏠";
  return [
    `${e} *${hook(variant)}*`,
    "",
    `*${offer.products.title}*`,
    "",
    ...priceLines(offer, "wa"),
    "",
    `🛒 ${offer.affiliate_url}`,
    "",
    `_Preço verificado em ${dateTime(offer.price_checked_at)}. Pode mudar a qualquer momento._`,
    `_Link de afiliado: posso receber comissão, sem custo extra para você._`,
  ].join("\n");
}

export function telegramMessage({ store, offer, variant }: ContentInput) {
  const e = store.brand.emoji || "🏠";
  return [
    `${e} ${hook(variant)}`,
    "",
    offer.products.title,
    ...priceLines(offer, "plain"),
    "",
    `🛒 ${offer.affiliate_url}`,
    "",
    `Preço verificado em ${dateTime(offer.price_checked_at)}. Link de afiliado.`,
  ].join("\n");
}

export function instagramCaption({ store, offer, variant }: ContentInput) {
  const cta = store.brand.bio_cta || "Link no canal do WhatsApp (link na bio) 👆";
  return [
    `${hook(variant)} 👀`,
    "",
    offer.products.title,
    ...priceLines(offer, "plain"),
    "",
    `👉 ${cta}`,
    "Comenta \"EU QUERO\" que eu te mando o link.",
    "",
    "Contém link de afiliado. Preço sujeito a alteração.",
    "",
    tags(store.brand, ["casa", "cozinha"]),
  ].join("\n");
}

export function tiktokCaption({ store, offer, variant }: ContentInput) {
  const price = offer.price_to ? ` por ${brl(offer.price_to)}` : "";
  return [
    `${hook(variant)}: ${offer.products.title}${price} 🔥`,
    "Link no perfil / canal do WhatsApp. Link de afiliado.",
    tags(store.brand, ["achadinhosdecasa", "fyp"]),
  ].join("\n");
}

export const GENERATORS: Record<Exclude<ContentKind, "reel">, (i: ContentInput) => string> = {
  whatsapp: whatsappMessage,
  telegram: telegramMessage,
  caption_instagram: instagramCaption,
  caption_tiktok: tiktokCaption,
};

export const HOOK_COUNT = HOOKS.length;
