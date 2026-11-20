import { btnCls, btnSmCls, Card, CardTitle, Empty, Field, inputCls, PageHeader } from "@/components/ui";
import { addSpend, createCampaign, deleteCampaign } from "@/lib/actions/ads";
import { getStore } from "@/lib/data";
import { brl, dayKey, num, pct } from "@/lib/format";

const AD_PLATFORMS: Record<string, string> = {
  tiktok_promote: "TikTok Promover",
  instagram_boost: "Instagram Turbinar",
  other: "Outro",
};

export default async function Anuncios({ params }: PageProps<"/s/[slug]/anuncios">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const [{ data: campaigns }, { data: spend }, { data: offers }, { data: conv }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("store_id", store.id).order("created_at", { ascending: false }),
    supabase.from("ad_spend").select("*").eq("store_id", store.id),
    supabase.from("offers").select("id, products(title)").eq("store_id", store.id).eq("status", "active").limit(200),
    supabase.from("conversions").select("offer_id, channel_type, ordered_at, commission_value, status").eq("store_id", store.id).neq("status", "cancelled"),
  ]);

  const rows = (campaigns ?? []).map((c) => {
    const s = (spend ?? []).filter((x) => x.campaign_id === c.id);
    const amount = s.reduce((a, x) => a + Number(x.amount), 0);
    const clicks = s.reduce((a, x) => a + (x.clicks ?? 0), 0);
    const inRange = (iso: string | null) => {
      if (!iso) return false;
      const d = dayKey(iso);
      return (!c.started_at || d >= c.started_at) && (!c.ended_at || d <= c.ended_at);
    };
    const channel = c.platform === "instagram_boost" ? "instagram" : "tiktok";
    const commission = (conv ?? [])
      .filter((x) => inRange(x.ordered_at) && (c.offer_id ? x.offer_id === c.offer_id : x.channel_type === channel))
      .reduce((a, x) => a + Number(x.commission_value), 0);
    return { ...c, amount, clicks, commission, cpc: clicks ? amount / clicks : null, roi: amount ? ((commission - amount) / amount) * 100 : null };
  });
  const today = dayKey(new Date());

  return (
    <>
      <PageHeader title="Anúncios" subtitle="Registre o gasto (ex.: TikTok Promover). Comissão atribuída pela oferta da campanha ou pelo canal, no período da campanha." />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Nova campanha</CardTitle>
          <form action={createCampaign} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="store_id" value={store.id} />
            <Field label="Nome"><input name="name" required className={inputCls} placeholder="Reel organizador de pia" /></Field>
            <Field label="Onde">
              <select name="platform" className={inputCls}>{Object.entries(AD_PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Oferta promovida (opcional)">
                <select name="offer_id" className={inputCls}>
                  <option value="">— atribuir pelo canal —</option>
                  {(offers ?? []).map((o) => <option key={o.id} value={o.id}>{(o.products as unknown as { title: string })?.title}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Início"><input type="date" name="started_at" defaultValue={today} className={inputCls} /></Field>
            <Field label="Fim"><input type="date" name="ended_at" className={inputCls} /></Field>
            <div><button className={btnCls}>Criar campanha</button></div>
          </form>
        </Card>
        <Card>
          <CardTitle>Lançar gasto</CardTitle>
          {rows.length === 0 ? <Empty>Crie uma campanha primeiro.</Empty> : (
            <form action={addSpend} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="store_id" value={store.id} />
              <div className="sm:col-span-2">
                <Field label="Campanha"><select name="campaign_id" className={inputCls}>{rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              </div>
              <Field label="Data"><input type="date" name="date" defaultValue={today} required className={inputCls} /></Field>
              <Field label="Valor (R$)"><input name="amount" inputMode="decimal" required className={inputCls} /></Field>
              <Field label="Visualizações"><input name="impressions" inputMode="numeric" className={inputCls} /></Field>
              <Field label="Cliques no link"><input name="clicks" inputMode="numeric" className={inputCls} /></Field>
              <div><button className={btnCls}>Salvar gasto</button></div>
            </form>
          )}
        </Card>
      </div>
      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? <div className="p-5"><Empty>Nenhuma campanha.</Empty></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-[11px] tracking-wider text-muted">
                <tr>{["CAMPANHA", "ONDE", "GASTO", "CLIQUES", "CPC", "COMISSÃO", "ROI", ""].map((h) => <th key={h} scope="col" className="p-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="p-3 font-semibold">{c.name}</td>
                    <td className="p-3">{AD_PLATFORMS[c.platform] ?? c.platform}</td>
                    <td className="p-3 tabular-nums">{brl(c.amount)}</td>
                    <td className="p-3 tabular-nums">{num(c.clicks)}</td>
                    <td className="p-3 tabular-nums">{c.cpc !== null ? brl(c.cpc) : "—"}</td>
                    <td className="p-3 tabular-nums">{brl(c.commission)}</td>
                    <td className={`p-3 font-bold tabular-nums ${c.roi !== null && c.roi < 0 ? "text-red-800" : "text-green-800"}`}>{pct(c.roi)}</td>
                    <td className="p-3"><form action={deleteCampaign}><input type="hidden" name="id" value={c.id} /><button className={`${btnSmCls} text-red-800`}>Excluir</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
