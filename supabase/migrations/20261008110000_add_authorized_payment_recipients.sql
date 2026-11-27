-- Beneficiários oficiais AgriLink para pagamentos manuais verificados.
-- O beneficiário nunca é escolhido por texto livre no checkout.
-- A marcação como pago só ocorre após verificação administrativa.

create table if not exists public.payment_authorized_recipients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 2 and 160),
  channel text not null check (channel in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay')),
  account_identifier text not null check (length(trim(account_identifier)) between 3 and 160),
  account_holder text not null check (length(trim(account_holder)) between 2 and 160),
  instructions text,
  currency text not null default 'AOA' check (currency = 'AOA'),
  active boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  max_amount numeric check (max_amount is null or max_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_authorized_recipients enable row level security;
revoke all on public.payment_authorized_recipients from anon, authenticated;

insert into public.payment_providers (id,display_name,enabled,test_mode)
values ('agrilink_authorized_recipient','AgriLink — Beneficiário Oficial',false,false)
on conflict (id) do update set display_name=excluded.display_name;

create index if not exists payment_authorized_recipients_active_idx
  on public.payment_authorized_recipients(active,verified_at);

create or replace function public.get_marketplace_checkout_summary(p_pre_order_id uuid)
returns table(pre_order_id uuid,product_total numeric,freight_total numeric,total numeric,currency text,payment_ready boolean,reason text)
language plpgsql stable security definer set search_path=public
as $$
declare
  v_order public.pre_orders%rowtype;
  v_freight numeric := 0;
  v_provider_ready boolean := false;
  v_recipient_ready boolean := false;
begin
  select * into v_order from public.pre_orders where id=p_pre_order_id and user_id=auth.uid();
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.status <> 'accepted' then
    return query select v_order.id,v_order.total_price,0::numeric,v_order.total_price,'AOA'::text,false,'WAITING_SELLER_ACCEPTANCE'::text;
    return;
  end if;
  select coalesce(fl.offered_price,fl.driver_offered_price,0) into v_freight
  from public.freight_loads fl where fl.pre_order_id=v_order.id order by fl.created_at desc limit 1;
  select exists(select 1 from public.payment_providers pp where pp.enabled=true and coalesce(pp.test_mode,false)=false) into v_provider_ready;
  select exists(select 1 from public.payment_authorized_recipients r
    where r.active=true and r.verified_at is not null
      and (r.max_amount is null or r.max_amount >= v_order.total_price+v_freight))
    into v_recipient_ready;
  return query select v_order.id,v_order.total_price,v_freight,v_order.total_price+v_freight,'AOA'::text,
    (v_freight>0 and (v_provider_ready or v_recipient_ready)),
    case when v_freight<=0 then 'WAITING_FREIGHT_QUOTE'
         when not v_provider_ready and not v_recipient_ready then 'WAITING_PAYMENT_PROVIDER'
         else 'READY' end;
end $$;

revoke all on function public.get_marketplace_checkout_summary(uuid) from public,anon;
grant execute on function public.get_marketplace_checkout_summary(uuid) to authenticated;

create or replace function public.get_marketplace_payment_recipients(p_pre_order_id uuid)
returns table(id uuid,display_name text,channel text,account_identifier text,account_holder text,instructions text,currency text)
language plpgsql stable security definer set search_path=public
as $$
declare v_order public.pre_orders%rowtype; v_total numeric;
begin
  select * into v_order from public.pre_orders where id=p_pre_order_id and user_id=auth.uid();
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.status <> 'accepted' then return; end if;
  select v_order.total_price + coalesce(
    (select coalesce(fl.offered_price,fl.driver_offered_price,0) from public.freight_loads fl
     where fl.pre_order_id=v_order.id order by fl.created_at desc limit 1),0) into v_total;
  return query select r.id,r.display_name,r.channel,r.account_identifier,r.account_holder,r.instructions,r.currency
  from public.payment_authorized_recipients r
  where r.active=true and r.verified_at is not null
    and (r.max_amount is null or r.max_amount>=v_total)
  order by r.display_name;
end $$;

revoke all on function public.get_marketplace_payment_recipients(uuid) from public,anon;
grant execute on function public.get_marketplace_payment_recipients(uuid) to authenticated;

create or replace function public.create_authorized_recipient_payment_intent(p_pre_order_id uuid,p_recipient_id uuid,p_idempotency_key uuid)
returns table(intent_id uuid,pre_order_id uuid,amount numeric,currency text,status text,recipient_id uuid,recipient_name text,account_identifier text)
language plpgsql security definer set search_path=public
as $$
declare
  v_order public.pre_orders%rowtype; v_freight numeric:=0; v_total numeric;
  v_rec public.payment_authorized_recipients%rowtype; v_intent public.payment_intents%rowtype;
begin
  select * into v_order from public.pre_orders where id=p_pre_order_id and user_id=auth.uid() for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'accepted' then raise exception 'CHECKOUT_NOT_READY'; end if;
  select coalesce(fl.offered_price,fl.driver_offered_price,0) into v_freight
  from public.freight_loads fl where fl.pre_order_id=v_order.id order by fl.created_at desc limit 1;
  if v_freight<=0 then raise exception 'FREIGHT_QUOTE_REQUIRED'; end if;
  v_total:=v_order.total_price+v_freight;
  select * into v_rec from public.payment_authorized_recipients
  where id=p_recipient_id and active=true and verified_at is not null
    and (max_amount is null or max_amount>=v_total) for update;
  if not found then raise exception 'PAYMENT_RECIPIENT_UNAVAILABLE'; end if;
  select * into v_intent from public.payment_intents
  where user_id=auth.uid() and idempotency_key=p_idempotency_key limit 1;
  if found then
    return query select v_intent.id,v_intent.pre_order_id,v_intent.amount,v_intent.currency,v_intent.status,
      v_rec.id,v_rec.display_name,v_rec.account_identifier;
    return;
  end if;
  insert into public.payment_intents(
    user_id,provider_id,idempotency_key,amount,currency,status,purpose,description,
    provider_payload,refunded_amount,pre_order_id)
  values(
    auth.uid(),'agrilink_authorized_recipient',p_idempotency_key,v_total,'AOA','pending',
    'order_payment','Pagamento AgriLink por beneficiário oficial',
    jsonb_build_object('recipient_id',v_rec.id,'recipient_name',v_rec.display_name),0,p_pre_order_id)
  returning * into v_intent;
  insert into public.payment_attempts(
    payment_intent_id,provider_id,attempt_number,status,request_payload,response_payload)
  values(
    v_intent.id,'agrilink_authorized_recipient',1,'pending',
    jsonb_build_object('recipient_id',v_rec.id,'channel',v_rec.channel,'account_identifier',v_rec.account_identifier),
    '{}'::jsonb);
  return query select v_intent.id,v_intent.pre_order_id,v_intent.amount,v_intent.currency,v_intent.status,
    v_rec.id,v_rec.display_name,v_rec.account_identifier;
end $$;

revoke all on function public.create_authorized_recipient_payment_intent(uuid,uuid,uuid) from public,anon;
grant execute on function public.create_authorized_recipient_payment_intent(uuid,uuid,uuid) to authenticated;

create or replace function public.submit_authorized_recipient_payment_proof(p_intent_id uuid,p_transfer_reference text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public
as $$
declare v_intent public.payment_intents%rowtype;
begin
  select * into v_intent from public.payment_intents where id=p_intent_id and user_id=auth.uid() for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_intent.provider_id <> 'agrilink_authorized_recipient' or v_intent.status not in ('pending','processing') then raise exception 'PAYMENT_NOT_ELIGIBLE'; end if;
  if p_transfer_reference is null or length(trim(p_transfer_reference)) not between 3 and 255 then raise exception 'TRANSFER_REFERENCE_REQUIRED'; end if;
  update public.payment_intents
  set provider_reference=trim(p_transfer_reference),status='processing',
      provider_payload=provider_payload || jsonb_build_object('payer_note',left(coalesce(p_note,''),500)),
      updated_at=now()
  where id=v_intent.id;
  update public.payment_attempts
  set status='processing',
      request_payload=request_payload || jsonb_build_object('transfer_reference',trim(p_transfer_reference),'payer_note',left(coalesce(p_note,''),500)),
      updated_at=now()
  where payment_intent_id=v_intent.id and attempt_number=1;
  return true;
end $$;

revoke all on function public.submit_authorized_recipient_payment_proof(uuid,text,text) from public,anon;
grant execute on function public.submit_authorized_recipient_payment_proof(uuid,text,text) to authenticated;

create or replace function public.verify_authorized_recipient_payment(p_intent_id uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
declare v_intent public.payment_intents%rowtype;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_intent from public.payment_intents where id=p_intent_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_intent.provider_id <> 'agrilink_authorized_recipient' or v_intent.status <> 'processing'
     or v_intent.provider_reference is null then raise exception 'PAYMENT_NOT_READY_FOR_VERIFICATION'; end if;
  update public.payment_intents set status='succeeded',completed_at=now(),succeeded_at=now(),updated_at=now() where id=v_intent.id;
  update public.payment_attempts
  set status='succeeded',
      response_payload=response_payload || jsonb_build_object('verified_by',auth.uid(),'verified_at',now()),
      completed_at=now(),updated_at=now()
  where payment_intent_id=v_intent.id and attempt_number=1;
  update public.pre_orders set payment_status='paid',updated_at=now()
  where id=v_intent.pre_order_id and user_id=v_intent.user_id and status='accepted';
  if not found then raise exception 'ORDER_NOT_PAYABLE'; end if;
  return true;
end $$;

revoke all on function public.verify_authorized_recipient_payment(uuid) from public,anon;
grant execute on function public.verify_authorized_recipient_payment(uuid) to authenticated;
