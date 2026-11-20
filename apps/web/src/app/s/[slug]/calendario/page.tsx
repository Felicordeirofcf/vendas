import { nowMs } from "@/lib/format";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { PostActions } from "@/components/post-actions";
import { btnSmCls, Card, Empty, PageHeader, Pill } from "@/components/ui";
import { getStore } from "@/lib/data";
import { dayKey, dayLabel, timeOnly } from "@/lib/format";
import { CHANNEL_LABEL, type ChannelType } from "@/lib/types";

type Post = {
  id: string; scheduled_at: string; channel_type: ChannelType; status: string; mode: string;
  content_items: { body: string; kind: string } | null;
};

const STATUS: Record<string, { label: string; tone: "line" | "ok" | "warn" | "dark" }> = {
  pending: { label: "Pendente", tone: "warn" },
  posted: { label: "Postado", tone: "ok" },
  skipped: { label: "Pulado", tone: "line" },
  failed: { label: "Falhou", tone: "dark" },
};

export default async function Calendario({ params, searchParams }: PageProps<"/s/[slug]/calendario">) {
  const { slug } = await params;
  const sp = await searchParams;
  const days = Math.min(60, Math.max(1, Number(sp.dias ?? 14)));
  const { supabase, store } = await getStore(slug);
  const from = new Date(nowMs() - 3 * 864e5).toISOString();
  const to = new Date(nowMs() + days * 864e5).toISOString();
  const { data } = await supabase.from("scheduled_posts")
    .select("id, scheduled_at, channel_type, status, mode, content_items(body, kind)")
    .eq("store_id", store.id).gte("scheduled_at", from).lte("scheduled_at", to).order("scheduled_at");
  const posts = (data ?? []) as unknown as Post[];

  const groups = new Map<string, Post[]>();
  posts.forEach((p) => {
    const k = dayKey(p.scheduled_at);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });
  const today = dayKey(new Date());

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle="O que postar, onde e quando. Últimos 3 dias e próximos dias."
        actions={<>
          {[7, 14, 30].map((d) => <Link key={d} href={`?dias=${d}`} className={btnSmCls} aria-current={d === days ? "page" : undefined}>{d} dias</Link>)}
          <Link href={`/s/${slug}/conteudo`} className={btnSmCls}>+ Novo post</Link>
        </>}
      />
      {groups.size === 0 ? <Empty>Nenhum post agendado. Gere conteúdo e escolha data e hora.</Empty> : (
        <div className="space-y-4">
          {[...groups.entries()].map(([k, list]) => (
            <Card key={k}>
              <h2 className="mb-3 text-sm font-bold capitalize">{dayLabel(k)}{k === today ? " · hoje" : ""}</h2>
              <ul className="divide-y divide-line">
                {list.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-12 text-sm font-bold tabular-nums">{timeOnly(p.scheduled_at)}</span>
                    <Pill>{CHANNEL_LABEL[p.channel_type]}</Pill>
                    <span className="min-w-0 flex-[1_1_220px] truncate text-sm">{p.content_items?.body.split("\n").find(Boolean)}</span>
                    {p.mode === "auto" ? <Pill tone="accent">automático</Pill> : null}
                    <Pill tone={STATUS[p.status]?.tone}>{STATUS[p.status]?.label ?? p.status}</Pill>
                    <CopyButton text={p.content_items?.body ?? ""} />
                    <PostActions id={p.id} status={p.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
