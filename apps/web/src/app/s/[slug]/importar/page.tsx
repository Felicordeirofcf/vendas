import { Card, CardTitle, PageHeader } from "@/components/ui";
import { OffersCsv, PasteImporter } from "@/components/importers";
import { getStore } from "@/lib/data";

export default async function Importar({ params }: PageProps<"/s/[slug]/importar">) {
  const { slug } = await params;
  const { store } = await getStore(slug);
  return (
    <>
      <PageHeader
        title="Importar links"
        subtitle="Mercado Livre: gere os links no Gerador de links do painel de afiliados e cole aqui. O sistema não acessa o site do ML."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right="Mercado Livre ou Shopee">Colar links</CardTitle>
          <PasteImporter storeId={store.id} />
        </Card>
        <Card>
          <CardTitle right="ex.: exportação de links da Shopee">Importar CSV de ofertas</CardTitle>
          <p className="mb-4 text-sm text-muted">Envie o CSV, confira o mapeamento das colunas e importe. Links já cadastrados têm o preço atualizado.</p>
          <OffersCsv storeId={store.id} />
        </Card>
      </div>
    </>
  );
}
