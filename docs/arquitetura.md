# Arquitetura e fases

## Stack
- **apps/web** — Next.js 16 na Vercel. Server Components + Server Actions falam direto com o Supabase
  usando a sessão do usuário (anon key + RLS). Nenhuma service key no app.
- **Supabase** — Postgres, Auth e (fase 5) Storage para Reels.
- **worker** (fase 3+) — Python no Render: API da Shopee, bot do Telegram, renderização de Reels.

## Fases
| Fase | Entrega | Status |
|---|---|---|
| 0 | Repo, migração, auth, deploy | ✅ |
| 1 | Multi-loja, catálogo, importação ML/Shopee (colar e CSV), gerador de WhatsApp/legendas | ✅ |
| 2 | Calendário, fila do WhatsApp, import de comissões e cliques (CSV) | ✅ |
| 6 | Anúncios (gasto, CPC, ROI) e painel | ✅ (versão inicial) |
| 2.5 | Vitrine pública, páginas de campanha, link rastreado `/r/[oferta]`, pixels Meta/TikTok com consentimento, CPC máximo, campanhas por etiqueta | ✅ |
| 3 | Shopee Affiliate API (busca, ranking, shortlink com subIds, conversionReport) | ⏳ |
| 4 | Bot do Telegram postando `scheduled_posts` com `mode = auto` | ⏳ |
| 5 | Gerador de Reels (script Pillow + ffmpeg como módulo, identidade por loja) | ⏳ |

## Atribuição
- Shopee: `subIds` = `loja|canal|post` no shortlink → `conversions.sub_id` → `channel_type`.
- Mercado Livre: etiqueta do Gerador de links por canal (ex.: `wa`, `tg`, `ig`, `tt`) no campo Sub ID do CSV.

## Funil de tráfego pago (sem rede social)
Anúncio → `/v/[loja]/[pagina]?c=<etiqueta>&utm_*` → botão da oferta → `/r/[oferta]` (registra em `link_clicks`) → link de afiliado.
- O público nunca lê tabelas: só as funções `get_public_store`, `get_public_page` e `track_click` (security definer, campos seguros).
- Vendas por campanha: use a mesma etiqueta no Gerador de links do ML; o CSV importado traz a etiqueta em `sub_id`.
- CPC máximo = preço × comissão % × conversão estimada % (configurável por loja).
- Alerta de corte: gasto ≥ 2× a comissão média de uma venda, sem vendas.
