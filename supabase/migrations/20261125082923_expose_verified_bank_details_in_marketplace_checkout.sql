drop function if exists public.get_marketplace_payment_recipients(uuid);
create function public.get_marketplace_payment_recipients(p_pre_order_id uuid)
returns table(id uuid,display_name text,channel text,bank_name text,account_identifier text,account_holder text,instructions text,currency text)
language plpgsql stable security definer set search_path=''
as $$
declare v_order public.pre_orders%rowtype; v_total numeric;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into v_order from public.pre_orders where id=p_pre_order_id and user_id=auth.uid();
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
 if v_order.status<>'accepted' or coalesce(v_order.payment_status,'unpaid')<>'unpaid' then return; end if;
 select v_order.total_price+coalesce((select coalesce(fl.offered_price,fl.driver_offered_price,0) from public.freight_loads fl where fl.pre_order_id=v_order.id order by fl.created_at desc limit 1),0) into v_total;
 return query select r.id,r.display_name,r.channel,r.bank_name,r.account_identifier,r.account_holder,r.instructions,r.currency
 from public.payment_authorized_recipients r
 where r.active=true and r.verified_at is not null and r.archived_at is null
 and (r.max_amount is null or r.max_amount>=v_total)
 order by r.sort_order,r.display_name;
end $$;
revoke all on function public.get_marketplace_payment_recipients(uuid) from public,anon;
grant execute on function public.get_marketplace_payment_recipients(uuid) to authenticated;

create or replace function public.get_marketplace_checkout_summary(p_pre_order_id uuid)
returns table(pre_order_id uuid,product_total numeric,freight_total numeric,total numeric,currency text,payment_ready boolean,reason text)
language plpgsql stable security definer set search_path=''
as $$
declare v_order public.pre_orders%rowtype; v_freight numeric:=0; v_provider_ready boolean:=false; v_recipient_ready boolean:=false;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into v_order from public.pre_orders where id=p_pre_order_id and user_id=auth.uid();
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
 if v_order.status<>'accepted' then
  return query select v_order.id,v_order.total_price,0::numeric,v_order.total_price,'AOA'::text,false,'WAITING_SELLER_ACCEPTANCE'::text; return;
 end if;
 if coalesce(v_order.payment_status,'unpaid')<>'unpaid' then
  return query select v_order.id,v_order.total_price,0::numeric,v_order.total_price,'AOA'::text,false,'ORDER_PAYMENT_NOT_UNPAID'::text; return;
 end if;
 select coalesce((select coalesce(fl.offered_price,fl.driver_offered_price,0) from public.freight_loads fl where fl.pre_order_id=v_order.id order by fl.created_at desc limit 1),0) into v_freight;
 select exists(select 1 from public.payment_providers pp where pp.enabled=true and coalesce(pp.test_mode,false)=false) into v_provider_ready;
 select exists(select 1 from public.payment_authorized_recipients r where r.active=true and r.verified_at is not null and r.archived_at is null and (r.max_amount is null or r.max_amount>=v_order.total_price+v_freight)) into v_recipient_ready;
 return query select v_order.id,v_order.total_price,v_freight,v_order.total_price+v_freight,'AOA'::text,
  (v_freight>0 and (v_provider_ready or v_recipient_ready)),
  case when v_freight<=0 then 'WAITING_FREIGHT_QUOTE' when not v_provider_ready and not v_recipient_ready then 'WAITING_PAYMENT_PROVIDER' else 'READY' end;
end $$;
revoke all on function public.get_marketplace_checkout_summary(uuid) from public,anon;
grant execute on function public.get_marketplace_checkout_summary(uuid) to authenticated;
