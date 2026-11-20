import Link from "next/link";
import { ShopeeImportButton } from "@/components/shopee-import";
import { btnSmCls, Card, Empty, inputCls, PageHeader, Pill } from "@/components/ui";
import { getStore } from "@/lib/data";
import { brl, num, pct } from "@/lib/format";
import type { ShopeeItem } from "@/lib/types";
import { searchShopeeOffers, workerConfigured, type ShopeeSort } from "@/lib/worker";

const SORTS: Record<ShopeeSort, string> = {
  score: "Melhor score (desconto + vendas + comissão)",
  discount: "Maior desconto",
  sales: "Mais vendidos",
  commission: "Maior comissão",
  relevance: "Relevância",
};

export default async function BuscarShopee({ params, searchParams }: PageProps<"/s/[slug]/shopee">) {
  const { slug } = await params;
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const keyword = str("q");
  const category = Number(str("cat")) || undefined;
  const sort = (str("sort") in SORTS ? str("sort") : "score") as ShopeeSort;
  const page = Math.max(1, Number(str("page")) || 1);
  const { supabase, store } = await getStore(slug);

  let items: ShopeeItem[] = [];
  let hasNext = false;
  let error = "";
  const searched = Boolean(keyword || category);
  if (searched && workerConfigured()) {
    try {
      const res = await searchShopeeOffers({ keyword, category, sort, page });
      items = res.items;
      hasNext = res.has_next;
    } catch (e) {
      error = e instanceof Error ? e.message : "Falha na busca";
    }
  }

  const imported = new Set<string>();
  if (items.length) {
    const { data } = await supabase.from("products").select("external_id")
      .eq("store_id", store.id).eq("platform", "shopee").in("external_id", items.map((i) => i.external_id));
    (data ?? []).forEach((p) => p.external_id && imported.add(p.external_id));
  }

  const pageHref = (p: number) => {
    const qs = new URLSearchParams({ sort, page: String(p) });
    if (keyword) qs.set("q", keyword);
    if (category) qs.set("cat", String(category));
    return `/s/${slug}/shopee?${qs}`;
  };

  return (
    <>
      <PageHeader
        title="Buscar ofertas Shopee"
        subtitle="Shopee Affiliate Open API oficial · o link importado já sai com subIds loja|canal|post"
        actions={<Link href={`/s/${slug}/catalogo?platform=shopee`} className={btnSmCls}>Ver no catálogo</Link>}
      />

      {!workerConfigured() ? (
        <Card><Empty>Configure <code>WORKER_URL</code> e <code>WORKER_TOKEN</code> na Vercel para buscar na Shopee.</Empty></Card>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap gap-2" role="search">
            <input name="q" defaultValue={keyword} placeholder="Palavra-chave (ex.: organizador)" className={`${inputCls} max-w-xs`} aria-label="Palavra-chave" />
            <input name="cat" defaultValue={category ?? ""} inputMode="numeric" placeholder="ID da categoria" className={`${inputCls} max-w-40`} aria-label="ID da categoria Shopee" />
            <select name="sort" defaultValue={sort} className={`${inputCls} max-w-xs`} aria-label="Ordenar por">
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className={btnSmCls}>Buscar</button>
          </form>
          {sort === "discount" || sort === "score" ? (
            <p className="mb-3 text-xs text-muted">A API não ordena por desconto/score: buscamos os mais vendidos e reordenamos cada página.</p>
          ) : null}

          {error ? <p className="mb-4 text-sm text-red-700" role="alert">{error}</p> : null}

          <Card className="overflow-hidden p-0">
            {!searched ? (
              <div className="p-5"><Empty>Busque por palavra-chave ou ID de categoria.</Empty></div>
            ) : items.length === 0 ? (
              <div className="p-5"><Empty>Nenhuma oferta encontrada.</Empty></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="text-left text-[11px] tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="p-3">PRODUTO</th>
                      <th scope="col" className="p-3">PREÇO</th>
                      <th scope="col" className="p-3">VENDAS</th>
                      <th scope="col" className="p-3">COMISSÃO</th>
                      <th scope="col" className="p-3">SCORE</th>
                      <th scope="col" className="p-3 text-right">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.external_id} className="border-t border-line align-top">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {it.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                            ) : <span className="h-12 w-12 shrink-0 rounded-lg bg-ground" />}
                            <div className="min-w-0">
                              <a href={it.product_url ?? "#"} target="_blank" rel="noreferrer" className="line-clamp-2 font-semibold hover:underline">{it.title}</a>
                              <div className="text-xs text-muted">
                                {it.shop_name ?? "—"}{it.rating ? ` · ★ ${it.rating.toFixed(1)}` : ""}
                                {imported.has(it.external_id) ? <> · <Pill tone="ok">no catálogo</Pill></> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {it.price_from ? <span className="text-xs text-muted line-through">{brl(it.price_from)}</span> : null}{" "}
                          <strong>{brl(it.price_to)}</strong>
                          {it.discount_pct ? <div className="text-xs font-bold text-green-800">-{pct(it.discount_pct)}</div> : null}
                        </td>
                        <td className="p-3">{num(it.sales)}</td>
                        <td className="p-3 whitespace-nowrap">
                          {pct(it.commission_pct, 1)}
                          {it.commission_value ? <div className="text-xs text-muted">{brl(it.commission_value)}</div> : null}
                        </td>
                        <td className="p-3"><Pill tone={it.score >= 60 ? "dark" : "line"}>{it.score.toFixed(0)}</Pill></td>
                        <td className="p-3 text-right">
                          <ShopeeImportButton storeId={store.id} item={it} imported={imported.has(it.external_id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {searched && (page > 1 || hasNext) ? (
            <nav aria-label="Páginas" className="mt-4 flex justify-between">
              {page > 1 ? <Link href={pageHref(page - 1)} className={btnSmCls}>← Anterior</Link> : <span />}
              {hasNext ? <Link href={pageHref(page + 1)} className={btnSmCls}>Próxima →</Link> : null}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
