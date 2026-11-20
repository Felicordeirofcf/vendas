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
| 3 | Shopee Affiliate API (busca, ranking, shortlink com subIds, conversionReport) | ⏳ |
| 4 | Bot do Telegram postando `scheduled_posts` com `mode = auto` | ⏳ |
| 5 | Gerador de Reels (script Pillow + ffmpeg como módulo, identidade por loja) | ⏳ |

## Atribuição
- Shopee: `subIds` = `loja|canal|post` no shortlink → `conversions.sub_id` → `channel_type`.
- Mercado Livre: etiqueta do Gerador de links por canal (ex.: `wa`, `tg`, `ig`, `tt`) no campo Sub ID do CSV.
