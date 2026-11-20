import { CopyButton } from "@/components/copy-button";
import { btnCls, btnSmCls, Card, CardTitle, Empty, Field, inputCls, PageHeader, Pill } from "@/components/ui";
import { addSpend, createCampaign, deleteCampaign } from "@/lib/actions/ads";
import { shouldCut } from "@/lib/ads-math";
import { getStore } from "@/lib/data";
import { brl, dayKey, num, pct } from "@/lib/format";
import { siteUrl } from "@/lib/site";

const AD_PLATFORMS: Record<string, { label: string; utm: string }> = {
  meta: { label: "Meta (Instagram/Facebook)", utm: "meta" },
  tiktok_promote: { label: "TikTok Ads / Promover", utm: "tiktok" },
  pinterest: { label: "Pinterest Ads", utm: "pinterest" },
  google: { label: "Google Ads", utm: "google" },
  instagram_boost: { label: "Instagram Turbinar", utm: "instagram" },
  other: { label: "Outro", utm: "outro" },
};

export default async function Anuncios({ params }: PageProps<"/s/[slug]/anuncios">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const [{ data: campaigns }, { data: spend }, { data: offers }, { data: conv }, { data: pages }, { data: clicks }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("store_id", store.id).order("created_at", { ascending: false }),
    supabase.from("ad_spend").select("*").eq("store_id", store.id),
    supabase.from("offers").select("id, products(title)").eq("store_id", store.id).eq("status", "active").limit(300),
    supabase.from("conversions").select("offer_id, channel_type, sub_id, ordered_at, commission_value, status").eq("store_id", store.id).neq("status", "cancelled").limit(10000),
    supabase.from("landing_pages").select("id, slug, title").eq("store_id", store.id),
    supabase.from("link_clicks").select("campaign, created_at").eq("store_id", store.id).not("campaign", "is", null).limit(50000),
  ]);
  const site = await siteUrl();
  const allConv = conv ?? [];
  const avgCommission = allConv.length ? allConv.reduce((a, x) => a + Number(x.commission_value), 0) / allConv.length : null;

  const rows = (campaigns ?? []).map((c) => {
    const s = (spend ?? []).filter((x) => x.campaign_id === c.id);
    const amount = s.reduce((a, x) => a + Number(x.amount), 0);
    const adClicks = s.reduce((a, x) => a + (x.clicks ?? 0), 0);
    const tag = (c.tag ?? "").toLowerCase();
    const realClicks = tag ? (clicks ?? []).filter((k) => (k.campaign ?? "").toLowerCase() === tag).length : 0;
    const inRange = (iso: string | null) => {
      if (!iso) return false;
      const d = dayKey(iso);
      return (!c.started_at || d >= c.started_at) && (!c.ended_at || d <= c.ended_at);
    };
    const channel = c.platform === "tiktok_promote" ? "tiktok" : "instagram";
    const sales = allConv.filter((x) => tag
      ? (x.sub_id ?? "").toLowerCase().includes(tag)
      : inRange(x.ordered_at) && (c.offer_id ? x.offer_id === c.offer_id : x.channel_type === channel));
    const commission = sales.reduce((a, x) => a + Number(x.commission_value), 0);
    const clicksUsed = realClicks || adClicks;
    const page = (pages ?? []).find((p) => p.id === c.landing_page_id);
    const utm = AD_PLATFORMS[c.platform]?.utm ?? "outro";
    const dest = `${site}/v/${store.slug}${page ? `/${page.slug}` : ""}?c=${encodeURIComponent(tag || c.id.slice(0, 8))}&utm_source=${utm}&utm_medium=paid&utm_campaign=${encodeURIComponent(tag || c.name)}`;
    return {
      ...c, amount, clicks: clicksUsed, realClicks, sales: sales.length, commission, dest, pageTitle: page?.title,
      cpc: clicksUsed ? amount / clicksUsed : null,
      roi: amount ? ((commission - amount) / amount) * 100 : null,
      cut: shouldCut(amount, sales.length, avgCommission),
    };
  });
  const today = dayKey(new Date());

  return (
    <>
      <PageHeader title="Anúncios" subtitle="Cada campanha tem uma etiqueta: use a mesma no Gerador de links do ML e no link do anúncio. Assim cliques e vendas caem na campanha certa." />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Nova campanha</CardTitle>
          <form action={createCampaign} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="store_id" value={store.id} />
            <Field label="Nome"><input name="name" required className={inputCls} placeholder="Air fryers · Black Friday" /></Field>
            <Field label="Etiqueta" hint="Letras minúsculas, números e hífen. Ex.: meta-af01"><input name="tag" required pattern="[a-z0-9_\-]+" className={inputCls} placeholder="meta-af01" /></Field>
            <Field label="Onde">
              <select name="platform" className={inputCls}>{Object.entries(AD_PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            </Field>
            <Field label="Página de destino">
              <select name="landing_page_id" className={inputCls}>
                <option value="">Vitrine da loja</option>
                {(pages ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Oferta principal (opcional)">
                <select name="offer_id" className={inputCls}>
                  <option value="">—</option>
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
          <CardTitle>Lançar gasto do dia</CardTitle>
          {rows.length === 0 ? <Empty>Crie uma campanha primeiro.</Empty> : (
            <form action={addSpend} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="store_id" value={store.id} />
              <div className="sm:col-span-2">
                <Field label="Campanha"><select name="campaign_id" className={inputCls}>{rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              </div>
              <Field label="Data"><input type="date" name="date" defaultValue={today} required className={inputCls} /></Field>
              <Field label="Valor gasto (R$)"><input name="amount" inputMode="decimal" required className={inputCls} /></Field>
              <Field label="Impressões"><input name="impressions" inputMode="numeric" className={inputCls} /></Field>
              <Field label="Cliques no link (da plataforma)"><input name="clicks" inputMode="numeric" className={inputCls} /></Field>
              <div><button className={btnCls}>Salvar gasto</button></div>
            </form>
          )}
        </Card>
      </div>

      {rows.length === 0 ? <Empty>Nenhuma campanha.</Empty> : (
        <div className="space-y-4">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="flex-[1_1_200px] text-base font-bold">{c.name}</h2>
                <Pill>{AD_PLATFORMS[c.platform]?.label ?? c.platform}</Pill>
                {c.tag ? <Pill tone="accent">etiqueta: {c.tag}</Pill> : null}
                {c.cut ? <Pill tone="warn">⚠ Cortar: gastou 2 vendas sem vender</Pill> : null}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
                {[
                  ["Gasto", brl(c.amount)],
                  [c.realClicks ? "Cliques reais" : "Cliques (plataforma)", num(c.clicks)],
                  ["CPC", c.cpc !== null ? brl(c.cpc) : "—"],
                  ["Vendas", num(c.sales)],
                  ["Comissão", brl(c.commission)],
                  ["Lucro", brl(c.commission - c.amount)],
                  ["ROI", pct(c.roi)],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-xs text-muted">{k}</p><p className="font-bold tabular-nums">{v}</p></div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-ground p-3 text-xs">
                <span className="font-semibold">Link para o anúncio{c.pageTitle ? ` (${c.pageTitle})` : " (vitrine)"}:</span>
                <code className="min-w-0 flex-1 truncate">{c.dest}</code>
                <CopyButton text={c.dest} label="Copiar" />
                <form action={deleteCampaign}><input type="hidden" name="id" value={c.id} /><button className={`${btnSmCls} text-red-800`}>Excluir</button></form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
