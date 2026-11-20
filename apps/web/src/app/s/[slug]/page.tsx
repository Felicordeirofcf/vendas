import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { btnSmCls, Card, CardTitle, Empty, Pill } from "@/components/ui";
import { getStore } from "@/lib/data";
import { brl, dayKey, hoursSince, num, pct, timeOnly } from "@/lib/format";
import { PERIODS, periodRange, type PeriodKey } from "@/lib/period";
import { CHANNEL_LABEL, PLATFORM_LABEL, STALE_HOURS, type ChannelType, type Platform } from "@/lib/types";

type Conv = { platform: Platform; offer_id: string | null; product_title: string | null; channel_type: string | null; ordered_at: string | null; commission_value: number; order_value: number | null; status: string };

function delta(cur: number, prev: number) {
  if (!prev) return cur ? { text: "novo", up: true } : { text: "—", up: true };
  const d = ((cur - prev) / prev) * 100;
  return { text: `${d >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(d))}%`, up: d >= 0 };
}

export default async function Dashboard({ params, searchParams }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const period = (typeof sp.p === "string" && sp.p in PERIODS ? sp.p : "mes") as PeriodKey;
  const r = periodRange(period);
  const { supabase, store } = await getStore(slug);

  const [convQ, clicksQ, spendQ, offersQ, queueQ, linkQ] = await Promise.all([
    supabase.from("conversions").select("platform, offer_id, product_title, channel_type, ordered_at, commission_value, order_value, status")
      .eq("store_id", store.id).gte("ordered_at", r.prevStart.toISOString()).lt("ordered_at", r.end.toISOString()).limit(10000),
    supabase.from("clicks_daily").select("platform, channel_type, date, clicks").eq("store_id", store.id)
      .gte("date", dayKey(r.prevStart)).lte("date", r.days[r.days.length - 1]),
    supabase.from("ad_spend").select("date, amount, clicks").eq("store_id", store.id)
      .gte("date", dayKey(r.prevStart)).lte("date", r.days[r.days.length - 1]),
    supabase.from("offers").select("id, price_checked_at, price_from, price_to, products(title, platform)").eq("store_id", store.id).eq("status", "active"),
    supabase.from("scheduled_posts").select("id, scheduled_at, channel_type, status, mode, content_items(body)").eq("store_id", store.id)
      .gte("scheduled_at", periodRange("hoje").start.toISOString()).lt("scheduled_at", periodRange("hoje").end.toISOString()).order("scheduled_at"),
    supabase.from("link_clicks").select("created_at, channel, offers(products(platform))").eq("store_id", store.id)
      .gte("created_at", r.prevStart.toISOString()).lt("created_at", r.end.toISOString()).limit(50000),
  ]);

  const startKey = r.days[0];
  const conv = ((convQ.data ?? []) as Conv[]).filter((c) => c.status !== "cancelled" && c.ordered_at);
  const cur = conv.filter((c) => new Date(c.ordered_at!) >= r.start);
  const prev = conv.filter((c) => new Date(c.ordered_at!) < r.start);
  const tracked = ((linkQ.data ?? []) as unknown as { created_at: string; channel: string | null; offers: { products: { platform: Platform } | null } | null }[])
    .map((l) => ({ platform: l.offers?.products?.platform ?? "mercadolivre", channel_type: l.channel ?? "vitrine", date: dayKey(l.created_at), clicks: 1 }));
  const clicks = [...(clicksQ.data ?? []), ...tracked];
  const spend = spendQ.data ?? [];
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

  const k = {
    clicks: sum(clicks.filter((c) => c.date >= startKey), (c) => c.clicks),
    clicksPrev: sum(clicks.filter((c) => c.date < startKey), (c) => c.clicks),
    orders: cur.length, ordersPrev: prev.length,
    comm: sum(cur, (c) => Number(c.commission_value)), commPrev: sum(prev, (c) => Number(c.commission_value)),
    commPending: sum(cur.filter((c) => c.status === "pending"), (c) => Number(c.commission_value)),
    spend: sum(spend.filter((s) => s.date >= startKey), (s) => Number(s.amount)),
    spendPrev: sum(spend.filter((s) => s.date < startKey), (s) => Number(s.amount)),
    adClicks: sum(spend.filter((s) => s.date >= startKey), (s) => s.clicks ?? 0),
  };
  const profit = k.comm - k.spend;
  const profitPrev = k.commPrev - k.spendPrev;
  const roi = k.spend ? ((k.comm - k.spend) / k.spend) * 100 : null;
  const conversion = k.clicks ? (k.orders / k.clicks) * 100 : null;

  const kpis = [
    { label: "Cliques", value: num(k.clicks), d: delta(k.clicks, k.clicksPrev), sub: `conv. ${pct(conversion, 1)}` },
    { label: "Pedidos", value: num(k.orders), d: delta(k.orders, k.ordersPrev), sub: k.orders ? `${brl(k.comm / k.orders)}/pedido` : "" },
    { label: "Comissão", value: brl(k.comm), d: delta(k.comm, k.commPrev), sub: k.commPending ? `${brl(k.commPending)} pendente` : "" },
    { label: "Gasto c/ anúncios", value: brl(k.spend), d: null, sub: k.adClicks ? `CPC ${brl(k.spend / k.adClicks)}` : "" },
    { label: "ROI dos anúncios", value: pct(roi), d: null, sub: k.spend ? "comissão vs gasto" : "sem gasto" },
    { label: "Lucro líquido", value: brl(profit), d: delta(profit, profitPrev), sub: "comissão − anúncios", dark: true },
  ];

  // plataforma
  const plat = (p: Platform) => ({
    clicks: sum(clicks.filter((c) => c.date >= startKey && c.platform === p), (c) => c.clicks),
    orders: cur.filter((c) => c.platform === p).length,
    comm: sum(cur.filter((c) => c.platform === p), (c) => Number(c.commission_value)),
  });
  const sh = plat("shopee"), ml = plat("mercadolivre");
  const duel = [
    { label: "cliques", a: num(sh.clicks), b: num(ml.clicks), va: sh.clicks, vb: ml.clicks },
    { label: "pedidos", a: num(sh.orders), b: num(ml.orders), va: sh.orders, vb: ml.orders },
    { label: "comissão", a: brl(sh.comm), b: brl(ml.comm), va: sh.comm, vb: ml.comm },
  ];

  // gráfico
  const chartDays = r.days.slice(-31);
  const chart = chartDays.map((d) => ({
    d,
    comm: sum(cur.filter((c) => dayKey(c.ordered_at!) === d), (c) => Number(c.commission_value)),
    spend: sum(spend.filter((s) => s.date === d), (s) => Number(s.amount)),
  }));
  const max = Math.max(1, ...chart.map((c) => Math.max(c.comm, c.spend)));

  // canais
  const chanMap = new Map<string, { clicks: number; orders: number }>();
  clicks.filter((c) => c.date >= startKey).forEach((c) => {
    const e = chanMap.get(c.channel_type) ?? { clicks: 0, orders: 0 };
    e.clicks += c.clicks; chanMap.set(c.channel_type, e);
  });
  cur.forEach((c) => {
    const key = c.channel_type ?? "desconhecido";
    const e = chanMap.get(key) ?? { clicks: 0, orders: 0 };
    e.orders += 1; chanMap.set(key, e);
  });
  const channels = [...chanMap.entries()].sort((a, b) => b[1].clicks - a[1].clicks);
  const maxCh = Math.max(1, ...channels.map(([, v]) => v.clicks));

  // produtos
  const prodMap = new Map<string, { title: string; platform: Platform; orders: number; comm: number }>();
  cur.forEach((c) => {
    const key = c.offer_id ?? c.product_title ?? "—";
    const e = prodMap.get(key) ?? { title: c.product_title ?? "Produto sem nome", platform: c.platform, orders: 0, comm: 0 };
    e.orders += 1; e.comm += Number(c.commission_value); prodMap.set(key, e);
  });
  const top = [...prodMap.values()].sort((a, b) => b.comm - a.comm).slice(0, 8);

  const offers = (offersQ.data ?? []) as unknown as { id: string; price_checked_at: string; products: { title: string; platform: Platform } }[];
  const stale = offers.filter((o) => hoursSince(o.price_checked_at) > STALE_HOURS[o.products?.platform ?? "mercadolivre"]);
  const queue = (queueQ.data ?? []) as unknown as { id: string; scheduled_at: string; channel_type: ChannelType; status: string; mode: string; content_items: { body: string } | null }[];
  const hasData = conv.length > 0 || clicks.length > 0 || spend.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">{store.name} · {store.niche}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Desempenho da loja</h1>
          <p className="mt-1 text-sm text-muted">Comissões dos relatórios importados · comparação com o período anterior</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <nav aria-label="Período" className="flex flex-wrap gap-1.5">
            {(Object.keys(PERIODS) as PeriodKey[]).map((p) => (
              <Link key={p} href={`?p=${p}`} aria-current={p === period ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${p === period ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                {PERIODS[p]}
              </Link>
            ))}
          </nav>
          <div className="flex gap-2">
            <Link href={`/s/${slug}/relatorios`} className={btnSmCls}>Importar relatório</Link>
            <Link href={`/s/${slug}/importar`} className="inline-flex min-h-8 items-center rounded-lg bg-ink px-3 text-xs font-semibold text-white">+ Nova oferta</Link>
          </div>
        </div>
      </div>

      {stale.length || queue.length ? (
        <div className="flex flex-wrap gap-3">
          {stale.length ? (
            <div className="flex flex-[1_1_320px] items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
              <span className="flex-1"><strong>{stale.length} oferta(s)</strong> com preço sem verificação. Confira antes de postar.</span>
              <Link href={`/s/${slug}/catalogo`} className="inline-flex min-h-10 items-center font-bold underline">Revisar</Link>
            </div>
          ) : null}
          {queue.length ? (
            <div className="flex flex-[1_1_320px] items-center gap-3 rounded-2xl border border-line bg-white px-4 py-2 text-sm">
              <span className="flex-1">Hoje: <strong>{queue.filter((q) => q.status === "posted").length} de {queue.length}</strong> posts feitos</span>
              <Link href={`/s/${slug}/calendario`} className="inline-flex min-h-10 items-center font-bold underline">Ver calendário</Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {kpis.map((x) => (
          <div key={x.label} className={`flex flex-col gap-2 rounded-2xl border p-4 ${x.dark ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            <span className={`text-sm font-medium ${x.dark ? "text-[#d6d3cc]" : "text-muted"}`}>{x.label}</span>
            <span className="text-2xl font-extrabold tracking-tight">{x.value}</span>
            <span className={`text-xs ${x.dark ? "text-[#d6d3cc]" : "text-muted"}`}>
              {x.d ? <strong className={x.d.up ? (x.dark ? "text-green-300" : "text-green-800") : (x.dark ? "text-red-300" : "text-red-800")}>{x.d.text} </strong> : null}
              {x.sub}
            </span>
          </div>
        ))}
      </div>

      {!hasData ? (
        <Empty>
          Ainda não há métricas neste período. Importe o relatório de comissões e cliques em{" "}
          <Link className="underline" href={`/s/${slug}/relatorios`}>Relatórios</Link> e os gastos em{" "}
          <Link className="underline" href={`/s/${slug}/anuncios`}>Anúncios</Link>.
        </Empty>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <Card className="flex-[3_1_420px]">
          <CardTitle right={<span className="inline-flex gap-3"><span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />Comissão</span><span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-ink" />Anúncios</span></span>}>
            Comissão × gasto com anúncios
          </CardTitle>
          <div className="overflow-x-auto">
            <div role="img" aria-label="Gráfico diário de comissão e gasto com anúncios" className="flex h-52 items-end gap-1 border-b border-line" style={{ minWidth: chart.length * 18 }}>
              {chart.map((c) => (
                <div key={c.d} className="flex h-full flex-1 items-end justify-center gap-0.5" title={`${c.d.slice(8)}/${c.d.slice(5, 7)}: ${brl(c.comm)} comissão · ${brl(c.spend)} anúncios`}>
                  <div className="w-[40%] max-w-4 rounded-t bg-accent" style={{ height: `${(c.comm / max) * 100}%` }} />
                  <div className="w-[40%] max-w-4 rounded-t bg-ink" style={{ height: `${(c.spend / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-1 pt-1" style={{ minWidth: chart.length * 18 }}>
              {chart.map((c, i) => <span key={c.d} className="flex-1 text-center text-[10px] text-muted">{chart.length <= 10 || i % 3 === 0 ? `${c.d.slice(8)}/${c.d.slice(5, 7)}` : ""}</span>)}
            </div>
          </div>
        </Card>
        <Card className="flex-[2_1_300px]">
          <CardTitle>Shopee × Mercado Livre</CardTitle>
          <div className="flex flex-col gap-5">
            {duel.map((d) => {
              const tot = d.va + d.vb;
              const pa = tot ? (d.va / tot) * 100 : 50;
              return (
                <div key={d.label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs"><span><strong>{d.a}</strong> Shopee</span><span className="text-muted">{d.label}</span><span>ML <strong>{d.b}</strong></span></div>
                  <div className="flex h-2 gap-0.5"><div className="rounded-full bg-accent" style={{ width: `${pa}%` }} /><div className="rounded-full bg-ink" style={{ width: `${100 - pa}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className="flex-[3_1_420px]">
          <CardTitle right={<Link className="underline" href={`/s/${slug}/calendario`}>abrir calendário</Link>}>Para postar hoje</CardTitle>
          {queue.length === 0 ? <Empty>Nada agendado para hoje. <Link className="underline" href={`/s/${slug}/conteudo`}>Gerar conteúdo</Link></Empty> : (
            <ul className="divide-y divide-line">
              {queue.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="w-11 text-sm font-bold tabular-nums">{timeOnly(q.scheduled_at)}</span>
                  <Pill>{CHANNEL_LABEL[q.channel_type]}</Pill>
                  <span className="min-w-0 flex-[1_1_160px] truncate text-sm">{q.content_items?.body.split("\n").find(Boolean)}</span>
                  {q.status === "posted" ? <span className="text-xs font-bold text-green-800">✓ Postado</span> : <CopyButton text={q.content_items?.body ?? ""} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex-[2_1_300px]">
          <CardTitle right="cliques · pedidos">Por canal</CardTitle>
          {channels.length === 0 ? <Empty>Sem dados de canal.</Empty> : (
            <div className="flex flex-col gap-3">
              {channels.map(([name, v]) => (
                <div key={name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm"><span className="font-semibold">{CHANNEL_LABEL[name as ChannelType] ?? name}</span><span className="tabular-nums">{num(v.clicks)} · <span className="text-muted">{v.orders} pedidos</span></span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-ground"><div className="h-full rounded-full bg-accent" style={{ width: `${(v.clicks / maxCh) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle right={<Link className="underline" href={`/s/${slug}/catalogo`}>ver catálogo</Link>}>Produtos que mais rendem</CardTitle>
        {top.length === 0 ? <Empty>Sem pedidos no período.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-[11px] tracking-wider text-muted">
                <tr><th scope="col" className="py-2">PRODUTO</th><th scope="col">PLATAFORMA</th><th scope="col" className="text-right">PEDIDOS</th><th scope="col" className="text-right">COMISSÃO</th></tr>
              </thead>
              <tbody>
                {top.map((t, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2.5 font-semibold">{t.title}</td>
                    <td><Pill tone={t.platform === "mercadolivre" ? "dark" : "accent"}>{PLATFORM_LABEL[t.platform]}</Pill></td>
                    <td className="text-right tabular-nums">{t.orders}</td>
                    <td className="text-right font-bold tabular-nums">{brl(t.comm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
