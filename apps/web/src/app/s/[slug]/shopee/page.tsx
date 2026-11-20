export const maxDuration = 300;

import { ShopeeStudio } from "@/components/shopee-studio";
import { PageHeader } from "@/components/ui";
import { getStore } from "@/lib/data";
import { shopeeConfigured } from "@/lib/shopee";

export default async function Shopee({ params }: PageProps<"/s/[slug]/shopee">) {
  const { slug } = await params;
  const { supabase, store } = await getStore(slug);
  const { data: pages } = await supabase.from("landing_pages").select("id, title").eq("store_id", store.id).order("created_at");
  return (
    <>
      <PageHeader title="Shopee" subtitle="API oficial de afiliados: busca, ranking, links de afiliado com subIds e atualização de preços. Sem scraping." />
      <ShopeeStudio storeId={store.id} storeSlug={store.slug} pages={pages ?? []} configured={shopeeConfigured()} />
    </>
  );
}
