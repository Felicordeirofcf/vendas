-- =====================================================================
-- Vendas · esquema inicial multi-loja
-- Toda tabela de negócio tem store_id e é protegida por RLS (membros da loja).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tipos ----------
do $$ begin
  create type platform as enum ('shopee', 'mercadolivre');
  create type channel_type as enum ('instagram', 'tiktok', 'whatsapp_channel', 'telegram');
  create type offer_status as enum ('draft', 'active', 'paused', 'expired');
  create type offer_source as enum ('shopee_api', 'manual', 'csv');
  create type content_kind as enum ('whatsapp', 'caption_instagram', 'caption_tiktok', 'telegram', 'reel');
  create type post_status as enum ('pending', 'posted', 'skipped', 'failed');
  create type conversion_status as enum ('pending', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------- lojas ----------
create table if not exists stores (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  niche       text,
  status      text not null default 'active' check (status in ('active', 'paused', 'archived')),
  -- {primary, secondary, dark, icon, hashtags[], whatsapp_url, bio_cta}
  brand       jsonb not null default '{}'::jsonb,
  timezone    text not null default 'America/Sao_Paulo',
  created_by  uuid references auth.users on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists store_members (
  store_id   uuid not null references stores on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table if not exists channels (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores on delete cascade,
  type         channel_type not null,
  handle       text,
  url          text,
  account_type text,                       -- criador, pessoal, canal...
  config       jsonb not null default '{}'::jsonb,  -- ex.: telegram chat_id (nunca token)
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (store_id, type)
);

create table if not exists affiliate_accounts (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores on delete cascade,
  platform        platform not null,
  label           text not null,           -- ex.: apelido ML "acheipracasa"
  credentials_env text,                    -- NOME da variável de ambiente, nunca o valor
  created_at      timestamptz not null default now(),
  unique (store_id, platform)
);

-- ---------- catálogo ----------
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores on delete cascade,
  platform    platform not null,
  external_id text,                        -- itemId Shopee / MLB...
  title       text not null,
  category    text,
  image_url   text,
  product_url text,
  created_at  timestamptz not null default now()
);
create unique index if not exists products_store_ext_uq
  on products (store_id, platform, external_id) where external_id is not null;

create table if not exists offers (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores on delete cascade,
  product_id       uuid not null references products on delete cascade,
  affiliate_url    text not null,
  price_from       numeric(12,2),
  price_to         numeric(12,2),
  discount_pct     numeric(5,1) generated always as (
                     case when price_from > 0 and price_to is not null and price_to < price_from
                          then round((1 - price_to / price_from) * 100, 1) end) stored,
  commission_pct   numeric(5,2),
  status           offer_status not null default 'active',
  source           offer_source not null default 'manual',
  price_checked_at timestamptz not null default now(),
  expires_at       timestamptz,
  score            numeric,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists offers_store_status_idx on offers (store_id, status);

create table if not exists price_snapshots (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores on delete cascade,
  offer_id    uuid not null references offers on delete cascade,
  price_from  numeric(12,2),
  price_to    numeric(12,2),
  captured_at timestamptz not null default now()
);

-- ---------- conteúdo e calendário ----------
create table if not exists templates (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid references stores on delete cascade,   -- null = global
  kind       content_kind not null,
  name       text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists content_items (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores on delete cascade,
  offer_id   uuid references offers on delete set null,
  kind       content_kind not null,
  body       text not null,
  media_url  text,
  created_at timestamptz not null default now()
);

create table if not exists scheduled_posts (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores on delete cascade,
  content_item_id uuid not null references content_items on delete cascade,
  channel_type    channel_type not null,
  scheduled_at    timestamptz not null,
  mode            text not null default 'manual' check (mode in ('manual', 'auto')),
  status          post_status not null default 'pending',
  posted_at       timestamptz,
  external_id     text,
  error           text,
  created_at      timestamptz not null default now()
);
create index if not exists scheduled_posts_store_time_idx on scheduled_posts (store_id, scheduled_at);

-- ---------- importações e métricas ----------
create table if not exists import_batches (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores on delete cascade,
  platform   platform not null,
  kind       text not null check (kind in ('links', 'conversions', 'clicks')),
  filename   text,
  rows_ok    int not null default 0,
  rows_err   int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists conversions (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores on delete cascade,
  platform         platform not null,
  order_id         text not null,
  item_id          text not null default '',
  offer_id         uuid references offers on delete set null,
  sub_id           text,
  channel_type     text,
  product_title    text,
  ordered_at       timestamptz,
  order_value      numeric(12,2),
  commission_value numeric(12,2) not null default 0,
  status           conversion_status not null default 'pending',
  raw              jsonb,
  import_batch_id  uuid references import_batches on delete set null,
  created_at       timestamptz not null default now(),
  unique (store_id, platform, order_id, item_id)
);
create index if not exists conversions_store_date_idx on conversions (store_id, ordered_at);

create table if not exists clicks_daily (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores on delete cascade,
  platform     platform not null,
  channel_type text not null default 'desconhecido',
  date         date not null,
  clicks       int not null default 0,
  unique (store_id, platform, channel_type, date)
);

-- ---------- anúncios ----------
create table if not exists ad_campaigns (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores on delete cascade,
  platform   text not null default 'tiktok_promote',
  name       text not null,
  offer_id   uuid references offers on delete set null,
  started_at date,
  ended_at   date,
  created_at timestamptz not null default now()
);

create table if not exists ad_spend (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores on delete cascade,
  campaign_id uuid not null references ad_campaigns on delete cascade,
  date        date not null,
  amount      numeric(12,2) not null,
  impressions int,
  clicks      int,
  unique (campaign_id, date)
);

-- =====================================================================
-- RLS
-- =====================================================================
create or replace function public.is_store_member(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_members where store_id = sid and user_id = auth.uid());
$$;

create or replace function public.add_store_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into store_members (store_id, user_id, role) values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists stores_add_owner on stores;
create trigger stores_add_owner after insert on stores
  for each row execute function public.add_store_owner();

alter table stores enable row level security;
drop policy if exists stores_select on stores;
create policy stores_select on stores for select to authenticated
  using (is_store_member(id) or created_by = auth.uid());
drop policy if exists stores_insert on stores;
create policy stores_insert on stores for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists stores_update on stores;
create policy stores_update on stores for update to authenticated
  using (is_store_member(id)) with check (is_store_member(id));
drop policy if exists stores_delete on stores;
create policy stores_delete on stores for delete to authenticated
  using (exists (select 1 from store_members m where m.store_id = id and m.user_id = auth.uid() and m.role = 'owner'));

alter table store_members enable row level security;
drop policy if exists members_select on store_members;
create policy members_select on store_members for select to authenticated
  using (user_id = auth.uid() or is_store_member(store_id));

alter table templates enable row level security;
drop policy if exists templates_select on templates;
create policy templates_select on templates for select to authenticated
  using (store_id is null or is_store_member(store_id));
drop policy if exists templates_write on templates;
create policy templates_write on templates for all to authenticated
  using (store_id is not null and is_store_member(store_id))
  with check (store_id is not null and is_store_member(store_id));

do $$
declare t text;
begin
  foreach t in array array['channels','affiliate_accounts','products','offers','price_snapshots',
                           'content_items','scheduled_posts','import_batches','conversions',
                           'clicks_daily','ad_campaigns','ad_spend'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_member', t);
    execute format('create policy %I on %I for all to authenticated using (is_store_member(store_id)) with check (is_store_member(store_id))', t || '_member', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;
