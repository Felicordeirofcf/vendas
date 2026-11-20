-- Preço da Shopee passa a ser atualizado pela API: vence em 24 h, como o do ML.
create or replace function public.public_offer_json(o offers, p products)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', o.id, 'title', p.title, 'image_url', p.image_url, 'platform', p.platform,
    'price_from', o.price_from, 'price_to', o.price_to, 'discount_pct', o.discount_pct,
    'price_checked_at', o.price_checked_at,
    'stale', now() - o.price_checked_at > interval '24 hours')
$$;
