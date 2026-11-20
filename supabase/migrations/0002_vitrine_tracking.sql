-- =====================================================================
-- 0002 · vitrine pública, páginas de campanha, cliques rastreados
-- O público (anon) NÃO lê tabelas: só chama funções que devolvem campos seguros.
-- =====================================================================

alter table stores add column if not exists is_public boolean not null default false;
-- {meta_pixel_id, tiktok_pixel_id, conv_estimate_pct, custom_domain}
alter table stores add column if not exists tracking jsonb not null default '{}'::jsonb;

alter table ad_campaigns add column if not exists tag text;              -- etiqueta do Gerador de links / ?c=
alter table ad_campaigns add column if not exists landing_page_id uuid;
create unique index if not exists ad_campaigns_store_tag_uq on ad_campaigns (store_id, tag) where tag is not null;

create table if not exists landing_pages (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores on delete cascade,
  slug       text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text not null,
  intro      text,
  outro      text,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

alter table ad_campaigns drop constraint if exists ad_campaigns_landing_page_fk;
alter table ad_campaigns add constraint ad_campaigns_landing_page_fk
  foreign key (landing_page_id) references landing_pages on delete set null;

create table if not exists landing_page_items (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores on delete cascade,
  page_id    uuid not null references landing_pages on delete cascade,
  offer_id   uuid not null references offers on delete cascade,
  position   int not null default 0,
  headline   text,
  blurb      text,
  pros       text,   -- uma vantagem por linha
  cons       text,   -- um ponto de atenção por linha
  unique (page_id, offer_id)
);

create table if not exists link_clicks (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores on delete cascade,
  offer_id     uuid references offers on delete set null,
  page_id      uuid references landing_pages on delete set null,
  campaign     text,
  channel      text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  has_fbclid   boolean not null default false,
  has_ttclid   boolean not null default false,
  referrer     text,
  created_at   timestamptz not null default now()
);
create index if not exists link_clicks_store_date_idx on link_clicks (store_id, created_at);
create index if not exists link_clicks_campaign_idx on link_clicks (store_id, campaign);

do $$
declare t text;
begin
  foreach t in array array['landing_pages','landing_page_items','link_clicks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_member', t);
    execute format('create policy %I on %I for all to authenticated using (is_store_member(store_id)) with check (is_store_member(store_id))', t || '_member', t);
  end loop;
end $$;

grant select, insert, update, delete on landing_pages, landing_page_items, link_clicks to authenticated;

-- ---------- funções públicas (security definer, só campos seguros) ----------

create or replace function public.public_offer_json(o offers, p products)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', o.id, 'title', p.title, 'image_url', p.image_url, 'platform', p.platform,
    'price_from', o.price_from, 'price_to', o.price_to, 'discount_pct', o.discount_pct,
    'price_checked_at', o.price_checked_at,
    'stale', now() - o.price_checked_at > case p.platform when 'shopee' then interval '6 hours' else interval '24 hours' end)
$$;

create or replace function public.get_public_store(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'niche', s.niche, 'brand', s.brand,
    'tracking', jsonb_build_object('meta_pixel_id', s.tracking->>'meta_pixel_id', 'tiktok_pixel_id', s.tracking->>'tiktok_pixel_id'),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('type', c.type, 'handle', c.handle, 'url', c.url))
                          from channels c where c.store_id = s.id and c.is_active and c.url is not null), '[]'),
    'offers', coalesce((select jsonb_agg(public_offer_json(o, p) order by o.created_at desc)
                        from offers o join products p on p.id = o.product_id
                        where o.store_id = s.id and o.status = 'active'), '[]'),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('slug', lp.slug, 'title', lp.title) order by lp.created_at desc)
                       from landing_pages lp where lp.store_id = s.id and lp.published), '[]'))
  from stores s where s.slug = p_slug and s.is_public and s.status = 'active'
$$;

create or replace function public.get_public_page(p_store text, p_page text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', lp.id, 'slug', lp.slug, 'title', lp.title, 'intro', lp.intro, 'outro', lp.outro,
    'updated_at', lp.updated_at,
    'items', coalesce((select jsonb_agg(public_offer_json(o, p) || jsonb_build_object(
                         'headline', i.headline, 'blurb', i.blurb, 'pros', i.pros, 'cons', i.cons) order by i.position)
                       from landing_page_items i join offers o on o.id = i.offer_id join products p on p.id = o.product_id
                       where i.page_id = lp.id and o.status = 'active'), '[]'))
  from landing_pages lp join stores s on s.id = lp.store_id
  where s.slug = p_store and s.is_public and lp.slug = p_page and lp.published
$$;

-- registra o clique e devolve o link de afiliado (só de oferta ativa de loja pública)
create or replace function public.track_click(
  p_offer uuid, p_campaign text default null, p_channel text default null, p_page text default null,
  p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null,
  p_fbclid boolean default false, p_ttclid boolean default false, p_referrer text default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_url text; v_store uuid; v_page uuid;
begin
  select o.affiliate_url, o.store_id into v_url, v_store
  from offers o join stores s on s.id = o.store_id
  where o.id = p_offer and o.status = 'active' and s.is_public;
  if v_url is null then return null; end if;
  if p_page is not null then
    select id into v_page from landing_pages where store_id = v_store and slug = p_page;
  end if;
  insert into link_clicks (store_id, offer_id, page_id, campaign, channel, utm_source, utm_medium, utm_campaign,
                           has_fbclid, has_ttclid, referrer)
  values (v_store, p_offer, v_page, left(p_campaign, 64), left(p_channel, 32), left(p_utm_source, 64),
          left(p_utm_medium, 64), left(p_utm_campaign, 128), coalesce(p_fbclid, false), coalesce(p_ttclid, false),
          left(p_referrer, 200));
  return v_url;
end $$;

revoke all on function public.get_public_store(text), public.get_public_page(text, text),
  public.track_click(uuid, text, text, text, text, text, text, boolean, boolean, text) from public;
grant execute on function public.get_public_store(text), public.get_public_page(text, text),
  public.track_click(uuid, text, text, text, text, text, text, boolean, boolean, text) to anon, authenticated;
