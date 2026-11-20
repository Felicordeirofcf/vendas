import type { Metadata } from "next";
import Link from "next/link";
import { OfferCard } from "@/components/public/offer-card";
import { ViewTracker } from "@/components/public/offer-cta";
import { getPublicStore, trackingQuery } from "@/lib/public";

export async function generateMetadata({ params }: PageProps<"/v/[store]">): Promise<Metadata> {
  const { store: slug } = await params;
  const s = await getPublicStore(slug);
  if (!s) return {};
  const title = `${s.name} · achadinhos de ${s.niche ?? "ofertas"}`;
  const description = `Os melhores achados de ${s.niche ?? "ofertas"} com preço verificado. Links de afiliado.`;
  return { title, description, openGraph: { title, description, type: "website" }, robots: { index: true, follow: true } };
}

export default async function Vitrine({ params, searchParams }: PageProps<"/v/[store]">) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const store = (await getPublicStore(slug))!;
  const fresh = store.offers.filter((o) => !o.stale);
  const offers = [...fresh, ...store.offers.filter((o) => o.stale)];
  const wa = store.channels.find((c) => c.type === "whatsapp_channel");

  return (
    <>
      <section className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Achados de {store.niche ?? "hoje"}</h1>
        <p className="mt-2 max-w-2xl text-[#4a4843]">Selecionamos produtos com bom custo-benefício e conferimos o preço antes de publicar. {wa ? "Quer receber as ofertas primeiro? Entre no canal do WhatsApp." : ""}</p>
        {store.pages.length ? (
          <nav aria-label="Seleções" className="mt-4 flex flex-wrap gap-2">
            {store.pages.map((p) => (
              <Link key={p.slug} href={`/v/${store.slug}/${p.slug}${trackingQuery(sp)}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-ink">{p.title}</Link>
            ))}
          </nav>
        ) : null}
      </section>
      {offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Novas ofertas em breve.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => <OfferCard key={o.id} offer={o} href={`/r/${o.id}${trackingQuery(sp, { ch: typeof sp.ch === "string" ? sp.ch : "vitrine" })}`} />)}
        </div>
      )}
      <ViewTracker ids={offers.slice(0, 20).map((o) => o.id)} />
    </>
  );
}
