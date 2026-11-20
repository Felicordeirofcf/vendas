# Vendas · gestão de lojas de afiliados

Sistema multi-loja para operar lojas de afiliados (Shopee e Mercado Livre): catálogo, importação de links,
gerador de mensagens e legendas, calendário, fila do WhatsApp, anúncios e painel de lucro.

## Estrutura

```
apps/web/               Next.js 16 (Vercel) — UI + server actions
worker/                 Python (Render) — Shopee Affiliate API, conversionReport, bot do Telegram
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

Rode as migrações em ordem (`0001_init.sql`, `0002_shopee_telegram.sql`) no SQL Editor do Supabase (ou `supabase db push`).

## Worker

```bash
cd worker
pip install -r requirements.txt pytest
pytest
uvicorn vendas_worker.app:app --reload   # variáveis em .env.example
```

Deploy: Blueprint `render.yaml`. Depois copie `WORKER_TOKEN` e a URL do serviço para a Vercel (`WORKER_TOKEN`, `WORKER_URL`).

## Regras de conformidade (no código)

- **Mercado Livre:** nenhuma requisição ao site/API do ML. Links vêm do Gerador de links (colados) e relatórios por CSV.
- **Shopee:** só a Affiliate Open API oficial (fase 3). Sem scraping.
- **WhatsApp:** sem API para canais — o sistema prepara a mensagem e você cola.
- **Instagram/TikTok:** postagem manual; legendas sempre com `#publi` e aviso de link de afiliado.
- **Segredos:** só em variáveis de ambiente. `.env*` está no `.gitignore`.
