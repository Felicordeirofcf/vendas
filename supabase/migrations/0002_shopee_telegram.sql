-- =====================================================================
-- Fase 3 (Shopee Affiliate API) e Fase 4 (bot do Telegram)
-- =====================================================================

-- vendas reportadas pela Shopee (productOfferV2.sales) para ranking
alter table products add column if not exists sales_count int;

-- controle de envio automático pelo worker
alter table scheduled_posts add column if not exists attempts  int not null default 0;
alter table scheduled_posts add column if not exists locked_at timestamptz;

create index if not exists scheduled_posts_auto_due_idx
  on scheduled_posts (scheduled_at) where mode = 'auto' and status = 'pending';

-- Reserva posts vencidos para um único worker (FOR UPDATE SKIP LOCKED).
-- Um lock mais velho que p_lock_minutes é considerado abandonado (worker caiu).
create or replace function public.claim_auto_posts(
  p_channel channel_type, p_limit int default 20, p_lock_minutes int default 10
) returns setof scheduled_posts
language sql security definer set search_path = public as $$
  update scheduled_posts sp
     set locked_at = now(), attempts = sp.attempts + 1
   where sp.id in (
     select id from scheduled_posts
      where mode = 'auto' and status = 'pending' and channel_type = p_channel
        and scheduled_at <= now()
        and (locked_at is null or locked_at < now() - make_interval(mins => p_lock_minutes))
      order by scheduled_at
      limit p_limit
      for update skip locked)
  returning sp.*;
$$;

-- só o worker (service_role) pode reservar posts
revoke all on function public.claim_auto_posts(channel_type, int, int) from public, anon, authenticated;
grant execute on function public.claim_auto_posts(channel_type, int, int) to service_role;
