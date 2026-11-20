import { ContentStudio } from "@/components/content-studio";
import { btnSmCls, Card, CardTitle, Empty, inputCls, PageHeader } from "@/components/ui";
import { getStore } from "@/lib/data";
import { brl, dateTime } from "@/lib/format";
import { KIND_LABEL, PLATFORM_LABEL, type ContentKind, type Offer } from "@/lib/types";

export default async function Conteudo({ params, searchParams }: PageProps<"/s/[slug]/conteudo">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, store } = await getStore(slug);
  const { data } = await supabase.from("offers").select("*, products(*)").eq("store_id", store.id)
    .eq("status", "active").order("created_at", { ascending: false }).limit(200);
  const offers = (data ?? []) as Offer[];
  const selected = offers.find((o) => o.id === sp.offer) ?? offers[0];

  const { data: recent } = await supabase.from("content_items").select("id, kind, body, created_at")
    .eq("store_id", store.id).order("created_at", { ascending: false }).limit(8);

  return (
    <>
      <PageHeader title="Conteúdo" subtitle="Mensagens e legendas geradas com a identidade da loja. #publi e aviso de afiliado entram automaticamente." />
      {offers.length === 0 ? (
        <Empty>Cadastre ou importe uma oferta ativa para gerar conteúdo.</Empty>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Oferta</span>
              <select name="offer" defaultValue={selected.id} className={`${inputCls} min-w-[320px]`}>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>{o.products.title} · {brl(o.price_to)} · {PLATFORM_LABEL[o.products.platform]}</option>
                ))}
              </select>
            </label>
            <button className={btnSmCls}>Carregar</button>
          </form>
          <ContentStudio
            key={selected.id}
            storeId={store.id}
            offerId={selected.id}
            input={{ store: { name: store.name, brand: store.brand }, offer: selected }}
          />
        </>
      )}
      <Card className="mt-6">
        <CardTitle right="últimos 8">Conteúdos salvos</CardTitle>
        {recent?.length ? (
          <ul className="divide-y divide-line">
            {recent.map((c) => (
              <li key={c.id} className="flex gap-3 py-2 text-sm">
                <span className="w-36 shrink-0 font-semibold">{KIND_LABEL[c.kind as ContentKind]}</span>
                <span className="flex-1 truncate text-muted">{c.body.split("\n").find(Boolean)}</span>
                <span className="text-xs text-muted">{dateTime(c.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Nada salvo ainda.</Empty>}
      </Card>
    </>
  );
}
