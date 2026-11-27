-- Checkout is available only through a live AgriLink-configured payment provider.
-- Manual recipient records are not a platform-account guarantee and are never used
-- to make a buyer checkout appear payable.
create or replace function public.get_marketplace_checkout_summary(p_pre_order_id uuid)
returns table (
  pre_order_id uuid,
  product_total numeric,
  freight_total numeric,
  total numeric,
  currency text,
  payment_ready boolean,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.pre_orders%rowtype;
  v_freight numeric := 0;
  v_provider_ready boolean := false;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_order
  from public.pre_orders
  where id = p_pre_order_id
    and user_id = auth.uid();

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.status <> 'accepted' then
    return query
    select v_order.id, v_order.total_price, 0::numeric, v_order.total_price,
      'AOA'::text, false, 'WAITING_SELLER_ACCEPTANCE'::text;
    return;
  end if;

  if coalesce(v_order.payment_status, 'unpaid') <> 'unpaid' then
    return query
    select v_order.id, v_order.total_price, 0::numeric, v_order.total_price,
      'AOA'::text, false, 'ORDER_PAYMENT_NOT_UNPAID'::text;
    return;
  end if;

  select coalesce(fl.driver_offered_price, fl.offered_price, 0)
  into v_freight
  from public.freight_loads fl
  where fl.pre_order_id = v_order.id
    and fl.driver_id is not null
    and fl.driver_quote_status = 'approved'
  order by fl.created_at desc
  limit 1;

  v_freight := coalesce(v_freight, 0);

  -- The Edge Function registry currently has no production adapters.
  -- Keep checkout closed until an AgriLink-owned merchant destination is configured
  -- and a production adapter is registered server-side.
  v_provider_ready := false;

  return query
  select
    v_order.id,
    v_order.total_price,
    v_freight,
    v_order.total_price + v_freight,
    'AOA'::text,
    (coalesce(v_order.total_price, 0) > 0 and v_freight > 0 and v_provider_ready),
    case
      when coalesce(v_order.total_price, 0) <= 0 then 'WAITING_ORDER_TOTAL'
      when v_freight <= 0 then 'WAITING_FREIGHT_QUOTE'
      when not v_provider_ready then 'WAITING_PAYMENT_PROVIDER'
      else 'READY'
    end;
end;
$$;

comment on function public.get_marketplace_checkout_summary(uuid) is
  'Returns checkout readiness only when the buyer has an approved driver quote and a live AgriLink-configured payment provider is enabled. Third-party recipient records never enable checkout.';
