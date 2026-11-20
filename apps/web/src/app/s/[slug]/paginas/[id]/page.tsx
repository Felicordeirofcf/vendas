import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { btnCls, btnSmCls, Card, CardTitle, Empty, Field, inputCls, PageHeader } from "@/components/ui";
import { addPageItem, deletePage, removePageItem, savePage } from "@/lib/actions/pages";
import { getStore } from "@/lib/data";
import { brl } from "@/lib/format";
import { siteUrl } from "@/lib/site";

type Item = { id: string; position: number; headline: string | null; blurb: string | null; pros: string | null; cons: string | null; offers: { id: string; price_to: number | null; products: { title: string } } };

export default async function EditarPagina({ params }: PageProps<"/s/[slug]/paginas/[id]">) {
  const { slug, id } = await params;
  const { supabase, store } = await getStore(slug);
  const [{ data: page }, { data: items }, { data: offers }] = await Promise.all([
    supabase.from("landing_pages").select("*").eq("id", id).eq("store_id", store.id).maybeSingle(),
    supabase.from("landing_page_items").select("id, position, headline, blurb, pros, cons, offers(id, price_to, products(title))").eq("page_id", id).order("position"),
    supabase.from("offers").select("id, price_to, products(title)").eq("store_id", store.id).eq("status", "active").order("created_at", { ascending: false }).limit(300),
  ]);
  if (!page) notFound();
  const list = (items ?? []) as unknown as Item[];
  const used = new Set(list.map((i) => i.offers?.id));
  const url = `${await siteUrl()}/v/${store.slug}/${page.slug}`;

  return (
    <>
      <PageHeader
        title={page.title}
        subtitle={<>Link público: <code>{url}</code></>}
        actions={<>
          <CopyButton text={url} label="Copiar link" className={btnSmCls} />
          <a href={url} target="_blank" rel="noreferrer" className={btnSmCls}>Ver página ↗</a>
          <Link href={`/s/${slug}/paginas`} className={btnSmCls}>Voltar</Link>
        </>}
      />
      <form action={savePage} className="space-y-4">
        <input type="hidden" name="id" value={page.id} />
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título"><input name="title" defaultValue={page.title} required className={inputCls} /></Field>
            <Field label="Endereço"><input name="slug" defaultValue={page.slug} required className={inputCls} /></Field>
            <div className="sm:col-span-2"><Field label="Introdução" hint="Conteúdo próprio: para quem é, como você escolheu, o que considerar. Parágrafos separados por linha em branco."><textarea name="intro" rows={4} defaultValue={page.intro ?? ""} className={inputCls} /></Field></div>
            <div className="sm:col-span-2"><Field label="Conclusão / dicas (opcional)"><textarea name="outro" rows={3} defaultValue={page.outro ?? ""} className={inputCls} /></Field></div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="published" defaultChecked={page.published} /> Publicada</label>
          </div>
        </Card>
        {list.length === 0 ? <Empty>Adicione produtos abaixo.</Empty> : list.map((it) => (
          <Card key={it.id}>
            <input type="hidden" name="item_id" value={it.id} />
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input name={`position_${it.id}`} defaultValue={it.position} aria-label="Posição" className="w-14 rounded-lg border border-line px-2 py-1 text-sm" />
              <strong className="flex-1">{it.offers?.products.title}</strong>
              <span className="text-sm">{brl(it.offers?.price_to)}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Destaque"><input name={`headline_${it.id}`} defaultValue={it.headline ?? ""} placeholder="Melhor custo-benefício" className={inputCls} /></Field>
              <Field label="Resumo"><input name={`blurb_${it.id}`} defaultValue={it.blurb ?? ""} placeholder="Para quem cozinha para 2 a 3 pessoas…" className={inputCls} /></Field>
              <Field label="Vantagens (uma por linha)"><textarea name={`pros_${it.id}`} rows={3} defaultValue={it.pros ?? ""} className={inputCls} /></Field>
              <Field label="Pontos de atenção (um por linha)"><textarea name={`cons_${it.id}`} rows={3} defaultValue={it.cons ?? ""} className={inputCls} /></Field>
            </div>
            <button formAction={removePageItem} name="remove_id" value={it.id} formNoValidate className={`${btnSmCls} mt-3 text-red-800`}>Remover da página</button>
          </Card>
        ))}
        <button className={btnCls}>Salvar página</button>
      </form>

      <Card className="mt-6">
        <CardTitle>Adicionar produto</CardTitle>
        <form action={addPageItem} className="flex flex-wrap gap-2">
          <input type="hidden" name="page_id" value={page.id} />
          <input type="hidden" name="store_id" value={store.id} />
          <select name="offer_id" required aria-label="Oferta" className={`${inputCls} max-w-md`}>
            {(offers ?? []).filter((o) => !used.has(o.id)).map((o) => (
              <option key={o.id} value={o.id}>{(o.products as unknown as { title: string })?.title} · {brl(o.price_to)}</option>
            ))}
          </select>
          <button className={btnSmCls}>Adicionar</button>
        </form>
      </Card>

      <form action={deletePage} className="mt-6">
        <input type="hidden" name="id" value={page.id} />
        <input type="hidden" name="store_slug" value={store.slug} />
        <button className={`${btnSmCls} text-red-800`}>Excluir página</button>
      </form>
    </>
  );
}
