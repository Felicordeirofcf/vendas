import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { btnCls, btnSmCls, Card, CardTitle, Empty, Field, inputCls, PageHeader, Pill } from "@/components/ui";
import { createPage } from "@/lib/actions/pages";
import { getStore } from "@/lib/data";
import { dateTime } from "@/lib/format";
import { siteUrl } from "@/lib/site";

export default async function Paginas({ params }: PageProps<"/s/[slug]/paginas">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const { data: pages } = await supabase.from("landing_pages").select("id, slug, title, published, updated_at, landing_page_items(count)")
    .eq("store_id", store.id).order("created_at", { ascending: false });
  const base = await siteUrl();
  const vitrine = `${base}/v/${store.slug}`;

  return (
    <>
      <PageHeader
        title="Páginas"
        subtitle="Vitrine pública e páginas de campanha com conteúdo próprio (exigência de Meta e Google para anúncios)."
        actions={<a href={vitrine} target="_blank" rel="noreferrer" className={btnSmCls}>Abrir vitrine ↗</a>}
      />
      {!store.is_public ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">A loja está <strong>privada</strong>: a vitrine e as páginas não abrem para o público. Ative em <Link className="underline" href={`/s/${slug}/config`}>Configurar loja</Link>.</p>
      ) : null}
      <Card className="mb-4">
        <CardTitle right="link na bio do Instagram/TikTok">Vitrine da loja</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <code className="rounded-lg bg-ground px-3 py-2">{vitrine}</code>
          <CopyButton text={`${vitrine}?ch=instagram`} label="Copiar p/ Instagram" />
          <CopyButton text={`${vitrine}?ch=tiktok`} label="Copiar p/ TikTok" />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardTitle>Páginas de campanha</CardTitle>
          {pages?.length ? (
            <ul className="divide-y divide-line">
              {pages.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link href={`/s/${slug}/paginas/${p.id}`} className="flex-[1_1_200px] font-semibold underline">{p.title}</Link>
                  <span className="text-xs text-muted">{(p.landing_page_items as unknown as { count: number }[])[0]?.count ?? 0} produtos · {dateTime(p.updated_at)}</span>
                  <Pill tone={p.published ? "ok" : "line"}>{p.published ? "Publicada" : "Rascunho"}</Pill>
                  <CopyButton text={`${vitrine}/${p.slug}`} label="Copiar link" />
                </li>
              ))}
            </ul>
          ) : <Empty>Nenhuma página ainda. Crie uma seleção, ex.: “3 air fryers que valem a pena”.</Empty>}
        </Card>
        <Card>
          <CardTitle>Nova página</CardTitle>
          <form action={createPage} className="grid gap-3">
            <input type="hidden" name="store_id" value={store.id} />
            <input type="hidden" name="store_slug" value={store.slug} />
            <Field label="Título"><input name="title" required className={inputCls} placeholder="3 air fryers que valem a pena em 2026" /></Field>
            <Field label="Endereço (opcional)"><input name="slug" className={inputCls} placeholder="air-fryers" /></Field>
            <button className={btnCls}>Criar e editar</button>
          </form>
        </Card>
      </div>
    </>
  );
}
