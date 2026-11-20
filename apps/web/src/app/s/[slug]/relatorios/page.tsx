import { ClicksCsv, ConversionsCsv } from "@/components/importers";
import { btnCls, Card, CardTitle, Empty, Field, inputCls, PageHeader } from "@/components/ui";
import { addClicksManual } from "@/lib/actions/reports";
import { getStore } from "@/lib/data";
import { dateTime, dayKey } from "@/lib/format";
import { PLATFORM_LABEL, type Platform } from "@/lib/types";

const KIND: Record<string, string> = { links: "Links", conversions: "Comissões", clicks: "Cliques" };

export default async function Relatorios({ params }: PageProps<"/s/[slug]/relatorios">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const { data: batches } = await supabase.from("import_batches").select("*").eq("store_id", store.id)
    .order("created_at", { ascending: false }).limit(15);
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Importe os CSVs de comissões e cliques exportados dos painéis de afiliado. Reimportar o mesmo pedido atualiza o status." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right="Shopee: Relatório de conversões · ML: relatório de vendas">Comissões / pedidos</CardTitle>
          <ConversionsCsv storeId={store.id} />
        </Card>
        <Card>
          <CardTitle right="Shopee: Relatório de cliques">Cliques</CardTitle>
          <ClicksCsv storeId={store.id} />
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold">Lançar cliques manualmente</summary>
            <form action={addClicksManual} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="store_id" value={store.id} />
              <Field label="Plataforma"><select name="platform" className={inputCls}><option value="mercadolivre">Mercado Livre</option><option value="shopee">Shopee</option></select></Field>
              <Field label="Canal"><select name="channel_type" className={inputCls}><option value="whatsapp_channel">WhatsApp</option><option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="desconhecido">Desconhecido</option></select></Field>
              <Field label="Data"><input type="date" name="date" defaultValue={dayKey(new Date())} className={inputCls} /></Field>
              <Field label="Cliques"><input name="clicks" inputMode="numeric" required className={inputCls} /></Field>
              <div><button className={btnCls}>Salvar</button></div>
            </form>
          </details>
        </Card>
      </div>
      <Card className="mt-6">
        <CardTitle>Últimas importações</CardTitle>
        {batches?.length ? (
          <ul className="divide-y divide-line text-sm">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap gap-3 py-2">
                <span className="w-36 text-muted">{dateTime(b.created_at)}</span>
                <span className="w-28 font-semibold">{KIND[b.kind] ?? b.kind}</span>
                <span className="w-28">{PLATFORM_LABEL[b.platform as Platform]}</span>
                <span className="flex-1 truncate text-muted">{b.filename ?? "colado/manual"}</span>
                <span>{b.rows_ok} ok{b.rows_err ? ` · ${b.rows_err} erro(s)` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Nenhuma importação ainda.</Empty>}
      </Card>
    </>
  );
}
