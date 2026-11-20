import { nowMs } from "@/lib/format";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { PostActions } from "@/components/post-actions";
import { btnSmCls, Card, Empty, PageHeader } from "@/components/ui";
import { getStore } from "@/lib/data";
import { dateTime } from "@/lib/format";

export default async function FilaWhatsApp({ params }: PageProps<"/s/[slug]/fila-whatsapp">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const [{ data }, { data: channel }] = await Promise.all([
    supabase.from("scheduled_posts").select("id, scheduled_at, status, content_items(body)")
      .eq("store_id", store.id).eq("channel_type", "whatsapp_channel").eq("status", "pending")
      .order("scheduled_at").limit(50),
    supabase.from("channels").select("url").eq("store_id", store.id).eq("type", "whatsapp_channel").maybeSingle(),
  ]);
  const posts = (data ?? []) as unknown as { id: string; scheduled_at: string; status: string; content_items: { body: string } | null }[];
  const now = nowMs();

  return (
    <>
      <PageHeader
        title="Fila do WhatsApp"
        subtitle="Canais do WhatsApp não têm API oficial: copie a mensagem, cole no canal e marque como postado."
        actions={channel?.url ? <a href={channel.url} target="_blank" rel="noreferrer" className={btnSmCls}>Abrir canal ↗</a> : <Link href={`/s/${slug}/config`} className={btnSmCls}>Cadastrar link do canal</Link>}
      />
      {posts.length === 0 ? <Empty>Fila vazia. Gere uma mensagem em Conteúdo e agende para o WhatsApp.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((p) => {
            const late = new Date(p.scheduled_at).getTime() < now;
            return (
              <Card key={p.id}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <strong>{dateTime(p.scheduled_at)}</strong>
                  {late ? <span className="text-xs font-bold text-orange-800">na hora / atrasado</span> : <span className="text-xs text-muted">agendado</span>}
                </div>
                <pre className="mb-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ground p-3 font-sans text-sm">{p.content_items?.body}</pre>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={p.content_items?.body ?? ""} label="Copiar mensagem" />
                  <PostActions id={p.id} status={p.status} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
