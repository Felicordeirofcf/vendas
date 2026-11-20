import { StoreForm } from "@/components/store-form";
import { PageHeader } from "@/components/ui";
import { getStore } from "@/lib/data";

export default async function Config({ params }: PageProps<"/s/[slug]/config">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const [{ data: channels }, { data: accounts }] = await Promise.all([
    supabase.from("channels").select("type, handle, url, account_type, config").eq("store_id", store.id),
    supabase.from("affiliate_accounts").select("platform, label").eq("store_id", store.id),
  ]);
  return (
    <>
      <PageHeader title="Configurar loja" subtitle="Identidade, redes, canais e contas de afiliado." />
      <StoreForm store={store} channels={channels ?? []} accounts={accounts ?? []} />
    </>
  );
}
