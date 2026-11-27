-- Fix PostgreSQL 42702 (column reference "id" is ambiguous).
-- RETURNS TABLE(id ...) creates an OUT parameter named id; qualify table columns
-- anywhere a query inside PL/pgSQL refers to an id column.

create or replace function public.get_marketplace_payment_recipients(p_pre_order_id uuid)
returns table(id uuid, display_name text, channel text, bank_name text, account_identifier text, account_holder text, instructions text, currency text)
language plpgsql stable security definer
set search_path = ''
as $function$
declare
  v_order public.pre_orders%rowtype;
  v_total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;

  select po.* into v_order
  from public.pre_orders as po
  where po.id = p_pre_order_id and po.user_id = auth.uid();

  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.status <> 'accepted' or coalesce(v_order.payment_status,'unpaid') <> 'unpaid' then return; end if;

  select v_order.total_price + coalesce((
    select coalesce(fl.offered_price,fl.driver_offered_price,0)
    from public.freight_loads as fl
    where fl.pre_order_id = v_order.id
    order by fl.created_at desc limit 1
  ),0) into v_total;

  return query
  select r.id,r.display_name,r.channel,r.bank_name,r.account_identifier,
         r.account_holder,r.instructions,r.currency
  from public.payment_authorized_recipients as r
  where r.active=true and r.verified_at is not null and r.archived_at is null
    and (r.max_amount is null or r.max_amount>=v_total)
  order by r.sort_order,r.display_name;
end;
$function$;

-- Same OUT-parameter collision existed in buyer cancellation.
create or replace function public.cancel_pre_order(p_order_id uuid)
returns table(id uuid, status text, updated_at timestamptz)
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_order public.pre_orders%rowtype;
begin
  if v_actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select po.* into v_order
  from public.pre_orders as po
  where po.id = p_order_id for update;

  if not found or v_order.user_id <> v_actor_id then raise exception 'Pre-order not found' using errcode='P0002'; end if;
  if v_order.status <> 'pending' then raise exception 'Only pending pre-orders can be cancelled by the buyer' using errcode='22023'; end if;

  update public.pre_orders as po
  set status='cancelled',updated_at=now()
  where po.id = p_order_id
  returning po.* into v_order;

  insert into public.audit_logs(event_type,action,user_id,details)
  values('PRE_ORDER_STATUS_CHANGED','BUYER_PRE_ORDER_CANCELLED',v_actor_id,
    jsonb_build_object('pre_order_id',v_order.id,'previous_status','pending','new_status','cancelled'));

  return query select v_order.id,v_order.status,coalesce(v_order.updated_at,now());
end;
$function$;

-- Keep SQL-language profile lookup explicitly qualified too.
create or replace function public.get_public_user_profile(p_user_id uuid)
returns table(id uuid, full_name text, avatar_url text, user_type public.user_type_enum, province_id text, municipality_id text, created_at timestamptz)
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $function$
  select u.id,u.full_name,u.avatar_url,u.user_type,u.province_id,u.municipality_id,u.created_at
  from public.users as u
  where u.id = p_user_id;
$function$;
