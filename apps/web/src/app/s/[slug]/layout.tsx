import { nowMs } from "@/lib/format";
import type { CSSProperties } from "react";
import { Sidebar } from "@/components/sidebar";
import { getStore, listStores } from "@/lib/data";
import { STALE_HOURS } from "@/lib/types";

export default async function StoreLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const stores = await listStores();

  const now = nowMs();
  const [{ data: offers }, { count: wa }] = await Promise.all([
    supabase.from("offers").select("price_checked_at, products(platform)").eq("store_id", store.id).eq("status", "active"),
    supabase.from("scheduled_posts").select("id", { count: "exact", head: true })
      .eq("store_id", store.id).eq("channel_type", "whatsapp_channel").eq("status", "pending")
      .lte("scheduled_at", new Date(now + 864e5).toISOString()),
  ]);
  const stale = (offers ?? []).filter((o) => {
    const p = (o.products as unknown as { platform: "shopee" | "mercadolivre" } | null)?.platform ?? "mercadolivre";
    return now - new Date(o.price_checked_at).getTime() > STALE_HOURS[p] * 36e5;
  }).length;

  const style = {
    "--accent": store.brand.primary || "#FF6B35",
    "--accent-2": store.brand.secondary || "#FFD23F",
  } as CSSProperties;

  return (
    <div style={style} className="flex min-h-screen flex-col md:flex-row">
      <Sidebar store={store} stores={stores} badges={{ stale, whatsapp: wa ?? 0 }} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
