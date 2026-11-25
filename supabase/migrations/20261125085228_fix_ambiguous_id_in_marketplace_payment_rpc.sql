-- Fix PostgreSQL 42702 in the marketplace payment recipient lookup.
-- RETURNS TABLE exposes an OUT parameter named "id"; every table column
-- is therefore qualified to avoid PL/pgSQL variable/column ambiguity.

create or replace function public.get_marketplace_payment_recipients(p_pre_order_id uuid)
returns table(
  id uuid,
  display_name text,
  channel text,
  bank_name text,
  account_identifier text,
  account_holder text,
  instructions text,
  currency text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_order public.pre_orders%rowtype;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  select po.*
    into v_order
  from public.pre_orders as po
  where po.id = p_pre_order_id
    and po.user_id = auth.uid();

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode='P0002';
  end if;

  if v_order.status <> 'accepted'
    or coalesce(v_order.payment_status,'unpaid') <> 'unpaid' then
    return;
  end if;

  select v_order.total_price + coalesce((
    select coalesce(fl.offered_price,fl.driver_offered_price,0)
    from public.freight_loads as fl
    where fl.pre_order_id = v_order.id
    order by fl.created_at desc
    limit 1
  ),0)
  into v_total;

  return query
  select r.id,r.display_name,r.channel,r.bank_name,
         r.account_identifier,r.account_holder,r.instructions,r.currency
  from public.payment_authorized_recipients as r
  where r.active = true
    and r.verified_at is not null
    and r.archived_at is null
    and (r.max_amount is null or r.max_amount >= v_total)
  order by r.sort_order,r.display_name;
end;
$function$;
