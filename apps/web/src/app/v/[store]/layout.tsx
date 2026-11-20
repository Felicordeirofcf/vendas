import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsentPixels } from "@/components/public/consent-pixels";
import { getPublicStore } from "@/lib/public";

export default async function PublicLayout({ children, params }: LayoutProps<"/v/[store]">) {
  const { store: slug } = await params;
  const store = await getPublicStore(slug);
  if (!store) notFound();
  const wa = store.channels.find((c) => c.type === "whatsapp_channel");
  const style = { "--accent": store.brand.primary || "#FF6B35", "--accent-2": store.brand.secondary || "#FFD23F" } as CSSProperties;

  return (
    <div style={style} className="min-h-screen bg-ground">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href={`/v/${store.slug}`} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-xl" aria-hidden="true">{store.brand.emoji || "🏠"}</span>
            <span className="flex flex-col leading-tight">
              <span className="font-extrabold">{store.name}</span>
              <span className="text-xs text-muted">{store.niche}</span>
            </span>
          </Link>
          {wa ? (
            <a href={wa.url} target="_blank" rel="noopener" className="ml-auto inline-flex min-h-10 items-center rounded-xl bg-ink px-4 text-sm font-bold text-white">
              Canal no WhatsApp
            </a>
          ) : null}
        </div>
      </header>
      <div className="bg-accent-2/60 px-4 py-2 text-center text-xs font-semibold text-ink">
        Esta página contém links de afiliado: podemos receber comissão pelas compras, sem custo extra para você.
      </div>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-xs text-muted">
          <span>© {store.name}</span>
          <span>Preços e disponibilidade podem mudar. A compra é feita na loja parceira, que é responsável pela venda e entrega.</span>
          <Link href={`/v/${store.slug}/privacidade`} className="underline">Privacidade e cookies</Link>
          {store.channels.filter((c) => c.type !== "whatsapp_channel").map((c) => (
            <a key={c.type} href={c.url} target="_blank" rel="noopener" className="underline">{c.handle ?? c.type}</a>
          ))}
        </div>
      </footer>
      <ConsentPixels metaPixelId={store.tracking.meta_pixel_id} tiktokPixelId={store.tracking.tiktok_pixel_id} privacyHref={`/v/${store.slug}/privacidade`} />
    </div>
  );
}
