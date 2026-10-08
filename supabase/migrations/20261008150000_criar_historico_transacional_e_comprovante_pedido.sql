create table if not exists public.order_transaction_events (
  id uuid primary key default gen_random_uuid(),
  pre_order_id uuid references public.pre_orders(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  freight_load_id uuid references public.freight_loads(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_transaction_events_scope_check check (pre_order_id is not null or order_id is not null or freight_load_id is not null)
);
create index if not exists idx_order_transaction_events_pre_order on public.order_transaction_events(pre_order_id,created_at);
create index if not exists idx_order_transaction_events_order on public.order_transaction_events(order_id,created_at);
create index if not exists idx_order_transaction_events_freight on public.order_transaction_events(freight_load_id,created_at);
alter table public.order_transaction_events enable row level security;
revoke all on public.order_transaction_events from anon,authenticated;
drop policy if exists "participants can view order transaction events" on public.order_transaction_events;
create policy "participants can view order transaction events"
on public.order_transaction_events for select to authenticated
using (
  exists (
    select 1 from public.pre_orders po
    left join public.products p on p.id=po.product_id
    where po.id=order_transaction_events.pre_order_id
      and (po.user_id=(select auth.uid()) or p.user_id=(select auth.uid()) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::public.app_role))
  )
  or exists (
    select 1 from public.orders o
    join public.pre_orders po on po.id=o.pre_order_id
    left join public.products p on p.id=po.product_id
    where o.id=order_transaction_events.order_id
      and (o.user_id=(select auth.uid()) or p.user_id=(select auth.uid()) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::public.app_role))
  )
  or exists (
    select 1 from public.freight_loads f
    join public.pre_orders po on po.id=f.pre_order_id
    left join public.products p on p.id=po.product_id
    where f.id=order_transaction_events.freight_load_id
      and (po.user_id=(select auth.uid()) or p.user_id=(select auth.uid()) or f.driver_id=(select auth.uid()) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::public.app_role))
  )
);

create or replace function public.record_order_transaction_event(p_event_type text,p_pre_order_id uuid default null,p_order_id uuid default null,p_freight_load_id uuid default null,p_from_status text default null,p_to_status text default null,p_actor_id uuid default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 insert into public.order_transaction_events(pre_order_id,order_id,freight_load_id,event_type,from_status,to_status,actor_id,metadata)
 values(p_pre_order_id,p_order_id,p_freight_load_id,p_event_type,p_from_status,p_to_status,coalesce(p_actor_id,auth.uid()),coalesce(p_metadata,'{}'::jsonb))
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.record_order_transaction_event(text,uuid,uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function public.log_pre_order_transaction_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  perform public.record_order_transaction_event('pre_order_created',new.id,null,null,null,new.status,new.user_id,jsonb_build_object('source','pre_orders'));
 elsif new.status is distinct from old.status then
  perform public.record_order_transaction_event('pre_order_status_changed',new.id,null,null,old.status,new.status,coalesce(auth.uid(),new.user_id),jsonb_build_object('source','pre_orders'));
 elsif new.payment_status is distinct from old.payment_status then
  perform public.record_order_transaction_event('payment_status_changed',new.id,null,null,old.payment_status,new.payment_status,coalesce(auth.uid(),new.user_id),jsonb_build_object('source','pre_orders'));
 end if;
 return new;
end $$;
drop trigger if exists trg_log_pre_order_transaction_event on public.pre_orders;
create trigger trg_log_pre_order_transaction_event after insert or update on public.pre_orders for each row execute function public.log_pre_order_transaction_event();

create or replace function public.log_order_transaction_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  perform public.record_order_transaction_event('order_created',null,new.id,null,null,new.status,new.user_id,jsonb_build_object('source','orders'));
 elsif new.status is distinct from old.status then
  perform public.record_order_transaction_event('order_status_changed',new.pre_order_id,new.id,null,old.status,new.status,coalesce(auth.uid(),new.user_id),jsonb_build_object('source','orders'));
 elsif new.payment_status is distinct from old.payment_status then
  perform public.record_order_transaction_event('order_payment_status_changed',new.pre_order_id,new.id,null,old.payment_status,new.payment_status,coalesce(auth.uid(),new.user_id),jsonb_build_object('source','orders'));
 end if;
 return new;
end $$;
drop trigger if exists trg_log_order_transaction_event on public.orders;
create trigger trg_log_order_transaction_event after insert or update on public.orders for each row execute function public.log_order_transaction_event();

create or replace function public.log_freight_transaction_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  perform public.record_order_transaction_event('freight_created',new.pre_order_id,new.order_id,new.id,null,new.status,new.created_by,jsonb_build_object('source','freight_loads'));
 elsif new.status is distinct from old.status then
  perform public.record_order_transaction_event('freight_status_changed',new.pre_order_id,new.order_id,new.id,old.status,new.status,coalesce(auth.uid(),new.driver_id,new.created_by),jsonb_build_object('source','freight_loads'));
 elsif new.driver_id is distinct from old.driver_id and new.driver_id is not null then
  perform public.record_order_transaction_event('driver_assigned',new.pre_order_id,new.order_id,new.id,null,new.status,new.driver_id,jsonb_build_object('source','freight_loads'));
 end if;
 return new;
end $$;
drop trigger if exists trg_log_freight_transaction_event on public.freight_loads;
create trigger trg_log_freight_transaction_event after insert or update on public.freight_loads for each row execute function public.log_freight_transaction_event();

create or replace function public.get_marketplace_transaction_history(p_pre_order_id uuid)
returns table(event_id uuid,event_type text,from_status text,to_status text,actor_id uuid,actor_role text,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_pre public.pre_orders%rowtype; v_product public.products%rowtype;
begin
 if v_uid is null then raise exception 'TRANSACTION_HISTORY_FORBIDDEN'; end if;
 select * into v_pre from public.pre_orders where id=p_pre_order_id;
 select * into v_product from public.products where id=v_pre.product_id;
 if v_pre.id is null or not (v_pre.user_id=v_uid or v_product.user_id=v_uid or public.is_root_admin(v_uid) or public.has_role(v_uid,'admin'::public.app_role) or exists(select 1 from public.freight_loads f where f.pre_order_id=p_pre_order_id and f.driver_id=v_uid)) then raise exception 'TRANSACTION_HISTORY_FORBIDDEN'; end if;
 return query
 select e.id,e.event_type,e.from_status,e.to_status,e.actor_id,
 case when e.actor_id=v_pre.user_id then 'buyer' when e.actor_id=v_product.user_id then 'seller' when exists(select 1 from public.freight_loads f where f.pre_order_id=p_pre_order_id and f.driver_id=e.actor_id) then 'driver' when public.is_root_admin(e.actor_id) or public.has_role(e.actor_id,'admin'::public.app_role) then 'admin' else 'system' end,
 e.metadata,e.created_at
 from public.order_transaction_events e where e.pre_order_id=p_pre_order_id order by e.created_at asc,e.id asc;
end $$;
revoke all on function public.get_marketplace_transaction_history(uuid) from public,anon;
grant execute on function public.get_marketplace_transaction_history(uuid) to authenticated;

create or replace function public.get_marketplace_transaction_receipt(p_pre_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 v_uid uuid:=auth.uid(); v_pre public.pre_orders%rowtype; v_product public.products%rowtype; v_buyer public.users%rowtype; v_seller public.users%rowtype;
 v_order public.orders%rowtype; v_freight public.freight_loads%rowtype; v_payment public.payment_intents%rowtype; v_p2p public.p2p_orders%rowtype;
 v_receipt text; v_hash text; v_history jsonb;
begin
 select * into v_pre from public.pre_orders where id=p_pre_order_id;
 select * into v_product from public.products where id=v_pre.product_id;
 if v_pre.id is null or not (v_pre.user_id=v_uid or v_product.user_id=v_uid or public.is_root_admin(v_uid) or public.has_role(v_uid,'admin'::public.app_role) or exists(select 1 from public.freight_loads f where f.pre_order_id=p_pre_order_id and f.driver_id=v_uid)) then raise exception 'TRANSACTION_RECEIPT_FORBIDDEN'; end if;
 select * into v_buyer from public.users where id=v_pre.user_id;
 select * into v_seller from public.users where id=v_product.user_id;
 select * into v_order from public.orders where pre_order_id=p_pre_order_id order by created_at desc limit 1;
 select * into v_freight from public.freight_loads where pre_order_id=p_pre_order_id order by created_at desc limit 1;
 select * into v_payment from public.payment_intents where pre_order_id=p_pre_order_id order by created_at desc limit 1;
 select * into v_p2p from public.p2p_orders where pre_order_id=p_pre_order_id order by created_at desc limit 1;
 v_receipt:='AGR-ORD-'||upper(substr(replace(p_pre_order_id::text,'-',''),1,12));
 select jsonb_agg(to_jsonb(h) order by h.created_at asc,h.event_id asc) into v_history from public.get_marketplace_transaction_history(p_pre_order_id) h;
 v_hash:=encode(digest(concat_ws('|',v_receipt,p_pre_order_id::text,coalesce(v_pre.total_price::text,''),coalesce(v_pre.status,''),coalesce(v_pre.payment_status,''),coalesce(v_order.id::text,''),coalesce(v_freight.id::text,''),coalesce(v_payment.id::text,''),coalesce(v_p2p.id::text,'')),'sha256'),'hex');
 return jsonb_build_object(
  'receipt_number',v_receipt,'validation_hash',upper(v_hash),'generated_at',now(),
  'pre_order',jsonb_build_object('id',v_pre.id,'status',v_pre.status,'payment_status',v_pre.payment_status,'quantity',v_pre.quantity,'unit_price',v_pre.unit_price,'total_price',v_pre.total_price,'location',v_pre.location,'created_at',v_pre.created_at),
  'product',jsonb_build_object('id',v_product.id,'name',v_product.product_type,'category',v_product.category,'province_id',v_product.province_id,'municipality_id',v_product.municipality_id),
  'buyer',jsonb_build_object('id',v_buyer.id,'name',v_buyer.full_name,'email',v_buyer.email),
  'seller',jsonb_build_object('id',v_seller.id,'name',v_seller.full_name,'email',v_seller.email),
  'order',case when v_order.id is null then null else jsonb_build_object('id',v_order.id,'status',v_order.status,'payment_status',v_order.payment_status,'total_price',v_order.total_price,'transport_fee',v_order.transport_fee,'paid_at',v_order.paid_at,'created_at',v_order.created_at) end,
  'payment',case when v_payment.id is null then null else jsonb_build_object('id',v_payment.id,'status',v_payment.status,'amount',v_payment.amount,'currency',v_payment.currency,'provider_id',v_payment.provider_id,'purpose',v_payment.purpose,'provider_reference',v_payment.provider_reference,'created_at',v_payment.created_at,'succeeded_at',v_payment.succeeded_at) end,
  'p2p',case when v_p2p.id is null then null else jsonb_build_object('id',v_p2p.id,'status',v_p2p.status,'amount',v_p2p.amount,'currency',v_p2p.currency,'payment_channel',v_p2p.payment_channel,'transfer_reference',v_p2p.transfer_reference,'created_at',v_p2p.created_at,'completed_at',v_p2p.completed_at) end,
  'freight',case when v_freight.id is null then null else jsonb_build_object('id',v_freight.id,'status',v_freight.status,'driver_id',v_freight.driver_id,'product_name',v_freight.product_name,'weight_kg',v_freight.weight_kg,'origin_label',v_freight.origin_label,'destination_label',v_freight.destination_label,'route_distance_km',v_freight.route_distance_km,'route_duration_minutes',v_freight.route_duration_minutes,'offered_price',v_freight.offered_price,'driver_offered_price',v_freight.driver_offered_price,'currency',v_freight.currency,'accepted_at',v_freight.accepted_at,'in_transit_at',v_freight.in_transit_at,'delivered_at',v_freight.delivered_at) end,
  'history',coalesce(v_history,'[]'::jsonb)
 );
end $$;
revoke all on function public.get_marketplace_transaction_receipt(uuid) from public,anon;
grant execute on function public.get_marketplace_transaction_receipt(uuid) to authenticated;
revoke all on function public.log_pre_order_transaction_event() from public,anon,authenticated;
revoke all on function public.log_order_transaction_event() from public,anon,authenticated;
revoke all on function public.log_freight_transaction_event() from public,anon,authenticated;

insert into public.order_transaction_events(pre_order_id,event_type,to_status,actor_id,metadata,created_at)
select po.id,'pre_order_created',po.status,po.user_id,jsonb_build_object('source','historical_backfill','derived_from','pre_orders.created_at'),po.created_at from public.pre_orders po where not exists (select 1 from public.order_transaction_events e where e.pre_order_id=po.id and e.event_type='pre_order_created');
insert into public.order_transaction_events(pre_order_id,freight_load_id,event_type,to_status,actor_id,metadata,created_at)
select f.pre_order_id,f.id,'freight_created',f.status,f.created_by,jsonb_build_object('source','historical_backfill','derived_from','freight_loads.created_at'),f.created_at from public.freight_loads f where f.pre_order_id is not null and not exists (select 1 from public.order_transaction_events e where e.freight_load_id=f.id and e.event_type='freight_created');
