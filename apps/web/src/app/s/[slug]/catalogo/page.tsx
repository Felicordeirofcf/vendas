import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { NewOfferForm } from "@/components/importers";
import { btnSmCls, Card, CardTitle, Empty, inputCls, PageHeader, Pill } from "@/components/ui";
import { deleteOffer, setOfferStatus, verifyPrice } from "@/lib/actions/offers";
import { getStore } from "@/lib/data";
import { brl, dateTime, hoursSince, pct } from "@/lib/format";
import { OFFER_STATUS_LABEL, PLATFORM_LABEL, STALE_HOURS, type Offer, type OfferStatus } from "@/lib/types";

export default async function Catalogo({ params, searchParams }: PageProps<"/s/[slug]/catalogo">) {
  const { slug } = await params;
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "active";
  const platform = typeof sp.platform === "string" ? sp.platform : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const { supabase, store } = await getStore(slug);

  let query = supabase.from("offers").select("*, products!inner(*)").eq("store_id", store.id)
    .order("created_at", { ascending: false }).limit(300);
  if (status !== "all") query = query.eq("status", status);
  if (platform) query = query.eq("products.platform", platform);
  if (q) query = query.ilike("products.title", `%${q}%`);
  const { data, error } = await query;
  const offers = (data ?? []) as Offer[];

  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle={`${offers.length} ofertas · preço vence após ${STALE_HOURS.mercadolivre} h (ML) e ${STALE_HOURS.shopee} h (Shopee) sem verificação`}
        actions={<Link href={`/s/${slug}/importar`} className={btnSmCls}>Importar links</Link>}
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar produto" className={`${inputCls} max-w-xs`} aria-label="Buscar produto" />
        <select name="status" defaultValue={status} className={`${inputCls} max-w-44`} aria-label="Status">
          <option value="all">Todos os status</option>
          {Object.entries(OFFER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="platform" defaultValue={platform} className={`${inputCls} max-w-44`} aria-label="Plataforma">
          <option value="">Todas as plataformas</option>
          <option value="shopee">Shopee</option>
          <option value="mercadolivre">Mercado Livre</option>
        </select>
        <button className={btnSmCls}>Filtrar</button>
      </form>

      {error ? <p className="mb-4 text-sm text-red-700">{error.message}</p> : null}

      <Card className="mb-6 overflow-hidden p-0">
        {offers.length === 0 ? (
          <div className="p-5"><Empty>Nenhuma oferta aqui ainda. Importe links ou adicione abaixo.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-[11px] tracking-wider text-muted">
                <tr>
                  <th scope="col" className="p-3">PRODUTO</th>
                  <th scope="col" className="p-3">PLATAFORMA</th>
                  <th scope="col" className="p-3">PREÇO</th>
                  <th scope="col" className="p-3">COMISSÃO</th>
                  <th scope="col" className="p-3">VERIFICADO</th>
                  <th scope="col" className="p-3">STATUS</th>
                  <th scope="col" className="p-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => {
                  const stale = hoursSince(o.price_checked_at) > STALE_HOURS[o.products.platform];
                  return (
                    <tr key={o.id} className="border-t border-line align-top">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {o.products.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.products.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : <span className="h-10 w-10 shrink-0 rounded-lg bg-ground" />}
                          <div className="min-w-0">
                            <div className="font-semibold">{o.products.title}</div>
                            <a href={o.affiliate_url} target="_blank" rel="noreferrer" className="block max-w-[260px] truncate text-xs text-muted underline">{o.affiliate_url}</a>
                          </div>
                        </div>
                      </td>
                      <td className="p-3"><Pill tone={o.products.platform === "mercadolivre" ? "dark" : "accent"}>{PLATFORM_LABEL[o.products.platform]}</Pill></td>
                      <td className="p-3 whitespace-nowrap">
                        {o.price_from ? <span className="text-xs text-muted line-through">{brl(o.price_from)}</span> : null}{" "}
                        <strong>{brl(o.price_to)}</strong>
                        {o.discount_pct ? <div className="text-xs font-bold text-green-800">-{pct(Number(o.discount_pct))}</div> : null}
                      </td>
                      <td className="p-3">{o.commission_pct ? pct(Number(o.commission_pct), 1) : "—"}</td>
                      <td className="p-3">
                        <span className={`text-xs ${stale ? "font-bold text-orange-800" : "text-muted"}`}>{dateTime(o.price_checked_at)}{stale ? " · vencido" : ""}</span>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs underline">Verifiquei agora</summary>
                          <form action={verifyPrice} className="mt-2 flex gap-1">
                            <input type="hidden" name="id" value={o.id} />
                            <input type="hidden" name="store_id" value={store.id} />
                            <input name="price_from" defaultValue={o.price_from ?? ""} aria-label="Preço de" className="w-20 rounded-lg border border-line px-2 py-1 text-xs" />
                            <input name="price_to" defaultValue={o.price_to ?? ""} aria-label="Preço por" className="w-20 rounded-lg border border-line px-2 py-1 text-xs" />
                            <button className={btnSmCls}>OK</button>
                          </form>
                        </details>
                      </td>
                      <td className="p-3">
                        <form action={setOfferStatus} className="flex gap-1">
                          <input type="hidden" name="id" value={o.id} />
                          <select name="status" defaultValue={o.status} aria-label="Status" className="rounded-lg border border-line px-2 py-1 text-xs">
                            {(Object.keys(OFFER_STATUS_LABEL) as OfferStatus[]).map((s) => <option key={s} value={s}>{OFFER_STATUS_LABEL[s]}</option>)}
                          </select>
                          <button className={btnSmCls}>Salvar</button>
                        </form>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Link href={`/s/${slug}/conteudo?offer=${o.id}`} className={btnSmCls}>Gerar conteúdo</Link>
                          <CopyButton text={o.affiliate_url} label="Copiar link" className={btnSmCls} />
                          <form action={deleteOffer}>
                            <input type="hidden" name="id" value={o.id} />
                            <button className={`${btnSmCls} text-red-800`} aria-label={`Excluir ${o.products.title}`}>Excluir</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Adicionar oferta manualmente</CardTitle>
        <NewOfferForm storeId={store.id} />
      </Card>
    </>
  );
}
