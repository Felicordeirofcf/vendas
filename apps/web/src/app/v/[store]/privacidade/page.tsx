import type { Metadata } from "next";
import { getPublicStore } from "@/lib/public";

export const metadata: Metadata = { title: "Privacidade e cookies" };

export default async function Privacidade({ params }: PageProps<"/v/[store]/privacidade">) {
  const { store: slug } = await params;
  const s = (await getPublicStore(slug))!;
  return (
    <article className="max-w-3xl space-y-4 leading-relaxed text-[#4a4843]">
      <h1 className="text-3xl font-extrabold text-ink">Privacidade e cookies</h1>
      <p><strong>{s.name}</strong> é uma página de recomendações de produtos com links de afiliado. Não vendemos produtos: a compra, o pagamento e a entrega acontecem na loja parceira (Shopee ou Mercado Livre), sob as regras e a política de privacidade dela.</p>
      <h2 className="pt-2 text-xl font-bold text-ink">O que coletamos</h2>
      <p>Quando você clica em uma oferta, registramos de forma agregada a oferta, a data, a campanha de origem (parâmetros da URL) e o site de onde você veio. Não coletamos nome, e-mail, telefone nem endereço IP.</p>
      <h2 className="pt-2 text-xl font-bold text-ink">Cookies de medição</h2>
      <p>Se você aceitar no aviso de cookies, carregamos o Pixel da Meta e/ou do TikTok para medir quais anúncios e ofertas geram interesse. Sem o seu aceite, eles não são carregados. Você pode mudar sua escolha limpando os dados deste site no navegador.</p>
      <h2 className="pt-2 text-xl font-bold text-ink">Links de afiliado</h2>
      <p>Podemos receber comissão quando você compra por um dos nossos links. Isso não altera o preço para você. Preços e disponibilidade mudam com frequência: sempre confira na loja antes de comprar.</p>
      <h2 className="pt-2 text-xl font-bold text-ink">Seus direitos (LGPD)</h2>
      <p>Você pode pedir informações ou exclusão de dados pelos nossos canais oficiais listados no rodapé.</p>
    </article>
  );
}
