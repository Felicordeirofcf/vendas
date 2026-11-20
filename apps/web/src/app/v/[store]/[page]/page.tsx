import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferCard } from "@/components/public/offer-card";
import { ViewTracker } from "@/components/public/offer-cta";
import { dateTime } from "@/lib/format";
import { getPublicPage, getPublicStore, trackingQuery } from "@/lib/public";

export async function generateMetadata({ params }: PageProps<"/v/[store]/[page]">): Promise<Metadata> {
  const { store, page } = await params;
  const [s, p] = await Promise.all([getPublicStore(store), getPublicPage(store, page)]);
  if (!s || !p) return {};
  const description = p.intro?.slice(0, 160) ?? `Seleção ${s.name}`;
  return { title: `${p.title} · ${s.name}`, description, openGraph: { title: p.title, description, type: "article" } };
}

export default async function Landing({ params, searchParams }: PageProps<"/v/[store]/[page]">) {
  const { store, page } = await params;
  const sp = await searchParams;
  const p = await getPublicPage(store, page);
  if (!p) notFound();
  const wa = (await getPublicStore(store))?.channels.find((c) => c.type === "whatsapp_channel");
  const paras = (s: string | null) => (s ?? "").split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);

  return (
    <article>
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{p.title}</h1>
        <p className="mt-2 text-xs text-muted">Atualizado em {dateTime(p.updated_at)}</p>
        {paras(p.intro).map((t, i) => <p key={i} className="mt-4 leading-relaxed text-[#4a4843]">{t}</p>)}
      </header>
      {p.items.length === 0 ? <p className="text-muted">Nenhum produto disponível agora.</p> : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {p.items.map((o, i) => (
            <OfferCard key={o.id} offer={o} rank={i + 1} detailed href={`/r/${o.id}${trackingQuery(sp, { p: p.slug })}`} />
          ))}
        </div>
      )}
      {paras(p.outro).length ? <section className="mt-10 max-w-3xl">{paras(p.outro).map((t, i) => <p key={i} className="mt-3 leading-relaxed text-[#4a4843]">{t}</p>)}</section> : null}
      {wa ? (
        <aside className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl bg-ink p-6 text-white">
          <p className="flex-[1_1_260px] text-lg font-bold">Receba achados como esses todo dia, de graça, no canal do WhatsApp.</p>
          <a href={wa.url} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-extrabold text-ink">Entrar no canal</a>
        </aside>
      ) : null}
      <ViewTracker ids={p.items.map((o) => o.id)} />
    </article>
  );
}
