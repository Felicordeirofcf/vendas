import Link from "next/link";
import { StoreForm } from "@/components/store-form";
import { PageHeader } from "@/components/ui";
import { listStores } from "@/lib/data";

export default async function NovaLoja() {
  const stores = await listStores();
  return (
    <main className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Nova loja"
        subtitle="Cada loja tem catálogo, conteúdo, canais e métricas próprios."
        actions={stores.length ? <Link className="text-sm underline" href={`/s/${stores[0].slug}`}>Voltar</Link> : null}
      />
      <StoreForm />
    </main>
  );
}
