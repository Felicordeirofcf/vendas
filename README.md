# Vendas · gestão de lojas de afiliados

Sistema multi-loja para operar lojas de afiliados (Shopee e Mercado Livre): catálogo, importação de links,
gerador de mensagens e legendas, calendário, fila do WhatsApp, anúncios e painel de lucro.

## Estrutura

```
apps/web/               Next.js 16 (Vercel) — UI + server actions
supabase/migrations/    Esquema Postgres com RLS por loja
docs/                   Arquitetura e plano de fases
```

## Rodar localmente

```bash
cd apps/web
cp ../../.env.example .env.local   # preencha as variáveis do Supabase
npm install
npm run dev
```

## Banco

Rode `supabase/migrations/0001_init.sql` no SQL Editor do Supabase (ou `supabase db push`).

## Regras de conformidade (no código)

- **Mercado Livre:** nenhuma requisição ao site/API do ML. Links vêm do Gerador de links (colados) e relatórios por CSV.
- **Shopee:** só a Affiliate Open API oficial (fase 3). Sem scraping.
- **WhatsApp:** sem API para canais — o sistema prepara a mensagem e você cola.
- **Instagram/TikTok:** postagem manual; legendas sempre com `#publi` e aviso de link de afiliado.
- **Segredos:** só em variáveis de ambiente. `.env*` está no `.gitignore`.
