-- QA/payment: bloquear novo checkout para pré-compras já pagas ou com pagamento
-- pendente, e impedir reutilização de chave idempotente para outra operação/beneficiário.

create or replace function public.get_marketplace_checkout_summary(p_pre_order_id uuid)
returns table(
  pre_order_id uuid,
  product_total numeric,
  freight_total numeric,
  total numeric,
  currency text,
  payment_ready boolean,
  reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_order public.pre_orders%rowtype;
  v_freight numeric := 0;
  v_provider_ready boolean := false;
  v_recipient_ready boolean := false;
begin
  select * into v_order
  from public.pre_orders
  where id = p_pre_order_id and user_id = auth.uid();

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.status <> 'accepted' then
    return query select v_order.id, v_order.total_price, 0::numeric,
      v_order.total_price, 'AOA'::text, false, 'WAITING_SELLER_ACCEPTANCE'::text;
    return;
  end if;

  if coalesce(v_order.payment_status, 'unpaid') <> 'unpaid' then
    return query select v_order.id, v_order.total_price, 0::numeric,
      v_order.total_price, 'AOA'::text, false, 'ORDER_PAYMENT_NOT_UNPAID'::text;
    return;
  end if;

  select coalesce(fl.offered_price, fl.driver_offered_price, 0)
  into v_freight
  from public.freight_loads fl
  where fl.pre_order_id = v_order.id
  order by fl.created_at desc
  limit 1;

  select exists(
    select 1 from public.payment_providers pp
    where pp.enabled = true and coalesce(pp.test_mode, false) = false
  ) into v_provider_ready;

  select exists(
    select 1 from public.payment_authorized_recipients r
    where r.active = true
      and r.verified_at is not null
      and (r.max_amount is null or r.max_amount >= v_order.total_price + v_freight)
  ) into v_recipient_ready;

  return query select
    v_order.id,
    v_order.total_price,
    v_freight,
    v_order.total_price + v_freight,
    'AOA'::text,
    (v_freight > 0 and (v_provider_ready or v_recipient_ready)),
    case
      when v_freight <= 0 then 'WAITING_FREIGHT_QUOTE'
      when not v_provider_ready and not v_recipient_ready then 'WAITING_PAYMENT_PROVIDER'
      else 'READY'
    end;
end;
$function$;

create or replace function public.create_authorized_recipient_payment_intent(
  p_pre_order_id uuid,
  p_recipient_id uuid,
  p_idempotency_key uuid
)
returns table(
  intent_id uuid,
  pre_order_id uuid,
  amount numeric,
  currency text,
  status text,
  recipient_id uuid,
  recipient_name text,
  account_identifier text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.pre_orders%rowtype;
  v_freight numeric := 0;
  v_total numeric;
  v_rec public.payment_authorized_recipients%rowtype;
  v_intent public.payment_intents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_pre_order_id is null or p_recipient_id is null or p_idempotency_key is null then
    raise exception 'INVALID_PAYMENT_REQUEST' using errcode = '22023';
  end if;

  select * into v_order
  from public.pre_orders
  where id = p_pre_order_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.status <> 'accepted' then
    raise exception 'CHECKOUT_NOT_READY' using errcode = '22023';
  end if;
  if coalesce(v_order.payment_status, 'unpaid') <> 'unpaid' then
    raise exception 'ORDER_PAYMENT_NOT_UNPAID' using errcode = '22023';
  end if;

  select coalesce(fl.offered_price, fl.driver_offered_price, 0)
  into v_freight
  from public.freight_loads fl
  where fl.pre_order_id = v_order.id
  order by fl.created_at desc
  limit 1;

  if v_freight <= 0 then
    raise exception 'FREIGHT_QUOTE_REQUIRED' using errcode = '22023';
  end if;
  v_total := v_order.total_price + v_freight;

  select * into v_intent
  from public.payment_intents
  where user_id = auth.uid()
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_intent.pre_order_id is distinct from p_pre_order_id
      or v_intent.provider_id is distinct from 'agrilink_authorized_recipient'
      or v_intent.purpose is distinct from 'order_payment'
      or v_intent.amount is distinct from v_total
      or v_intent.provider_payload->>'recipient_id' is distinct from p_recipient_id::text then
      raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' using errcode = '22023';
    end if;

    select * into v_rec
    from public.payment_authorized_recipients
    where id = p_recipient_id
      and active = true
      and verified_at is not null
      and (max_amount is null or max_amount >= v_total)
    for update;

    if not found then
      raise exception 'PAYMENT_RECIPIENT_UNAVAILABLE' using errcode = '22023';
    end if;

    return query select v_intent.id, v_intent.pre_order_id, v_intent.amount,
      v_intent.currency, v_intent.status, v_rec.id, v_rec.display_name, v_rec.account_identifier;
    return;
  end if;

  if exists (
    select 1 from public.payment_intents pi
    where pi.pre_order_id = p_pre_order_id
      and pi.status in ('created', 'pending', 'processing')
  ) then
    raise exception 'PAYMENT_INTENT_ALREADY_EXISTS' using errcode = '23505';
  end if;

  select * into v_rec
  from public.payment_authorized_recipients
  where id = p_recipient_id
    and active = true
    and verified_at is not null
    and (max_amount is null or max_amount >= v_total)
  for update;

  if not found then
    raise exception 'PAYMENT_RECIPIENT_UNAVAILABLE' using errcode = '22023';
  end if;

  insert into public.payment_intents(
    user_id, provider_id, idempotency_key, amount, currency, status, purpose,
    description, provider_payload, refunded_amount, pre_order_id
  )
  values(
    auth.uid(), 'agrilink_authorized_recipient', p_idempotency_key, v_total, 'AOA',
    'pending', 'order_payment', 'Pagamento AgriLink por beneficiário oficial',
    jsonb_build_object('recipient_id', v_rec.id, 'recipient_name', v_rec.display_name), 0,
    p_pre_order_id
  )
  returning * into v_intent;

  insert into public.payment_attempts(
    payment_intent_id, provider_id, attempt_number, status, request_payload, response_payload
  )
  values(
    v_intent.id, 'agrilink_authorized_recipient', 1, 'pending',
    jsonb_build_object('recipient_id', v_rec.id, 'channel', v_rec.channel,
      'account_identifier', v_rec.account_identifier),
    '{}'::jsonb
  );

  return query select v_intent.id, v_intent.pre_order_id, v_intent.amount,
    v_intent.currency, v_intent.status, v_rec.id, v_rec.display_name, v_rec.account_identifier;
end;
$function$;
