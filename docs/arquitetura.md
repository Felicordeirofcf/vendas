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
| 3 | Shopee Affiliate API (busca, ranking, shortlink com subIds, conversionReport) | ✅ (worker + `/s/[slug]/shopee`) |
| 4 | Bot do Telegram postando `scheduled_posts` com `mode = auto` | ✅ (worker) |
| 5 | Gerador de Reels (script Pillow + ffmpeg como módulo, identidade por loja) | ⏳ |

## Worker (`worker/`, Render)
- FastAPI com token (`WORKER_TOKEN`): `GET /shopee/offers`, `POST /shopee/shortlink`, `POST /jobs/{telegram|conversions}`.
  Só o servidor do apps/web chama (Server Actions/Components); o navegador nunca vê o token.
- Agendador interno (`RUN_SCHEDULER=true`): Telegram a cada 60 s, conversionReport a cada 120 min.
- Grava no Supabase com a service role (só no Render). Posts são reservados por `claim_auto_posts()`
  (`FOR UPDATE SKIP LOCKED`), então nunca saem duas vezes; falha temporária tenta de novo até 3×.
- Posts atrasados mais que `TELEGRAM_MAX_DELAY_MIN` viram `skipped` (não dispara fila velha após queda).

## Atribuição
- Shopee: `subIds` = `loja|canal|post` no shortlink → `conversions.sub_id` → `channel_type`.
  Cada subId só tem letras e números (a Shopee junta tudo com "-" no `utmContent`): `acheipracasa-tg-3f2a9c1eaaaa`.
  Importação gera `loja|base|itemId`; ao agendar, o link é trocado por `loja|canal|post`.
- Mercado Livre: etiqueta do Gerador de links por canal (ex.: `wa`, `tg`, `ig`, `tt`) no campo Sub ID do CSV.
