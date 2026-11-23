-- Structural regression tests for centralized marketplace allocations.
-- Behavioural checkout tests require a configured PSP sandbox and isolated
-- payment fixtures; this file verifies the database gates after migrations.

do $test$
declare
  v_recipient_nullable boolean;
  v_platform_fee_index boolean;
  v_payment_trigger boolean;
  v_release_trigger boolean;
  v_function_security_definer boolean;
  v_policy_exists boolean;
  v_payout_trigger boolean;
begin
  select not a.attnotnull
  into v_recipient_nullable
  from pg_attribute a
  where a.attrelid = 'public.payment_allocations'::regclass
    and a.attname = 'recipient_user_id'
    and not a.attisdropped;

  if v_recipient_nullable is distinct from true then
    raise exception 'Platform fee allocation must not require a fictitious user recipient';
  end if;

  select exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'ux_payment_allocations_platform_fee'
  ) into v_platform_fee_index;

  if not v_platform_fee_index then
    raise exception 'Platform fee allocation must be unique per payment intent';
  end if;

  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.payment_intents'::regclass
      and tgname = 'trg_create_marketplace_payment_allocations'
      and not tgisinternal
  ) into v_payment_trigger;

  if not v_payment_trigger then
    raise exception 'Verified payment success must create marketplace allocations';
  end if;

  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.freight_loads'::regclass
      and tgname = 'trg_release_marketplace_allocations_after_buyer_receipt'
      and not tgisinternal
  ) into v_release_trigger;

  if not v_release_trigger then
    raise exception 'Buyer receipt confirmation must release blocked allocations';
  end if;

  select p.prosecdef
  into v_function_security_definer
  from pg_proc p
  where p.oid = 'public.create_marketplace_payment_allocations()'::regprocedure;

  if v_function_security_definer is distinct from true then
    raise exception 'Payment allocation trigger function must execute with controlled privileges';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_allocations'
      and policyname = 'Payment participants can read allocations'
  ) into v_policy_exists;

  if not v_policy_exists then
    raise exception 'Payment allocations must be readable only by participants and admins';
  end if;

  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.payment_allocations'::regclass
      and tgname = 'trg_create_marketplace_payout_intent'
      and not tgisinternal
  ) into v_payout_trigger;

  if not v_payout_trigger then
    raise exception 'Available seller and driver allocations must create payout intents';
  end if;

  if to_regclass('public.marketplace_payouts') is null then
    raise exception 'Separate marketplace payout intent table must exist';
  end if;

  if has_table_privilege('authenticated', 'public.payment_allocations', 'INSERT')
     or has_table_privilege('authenticated', 'public.payment_allocations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.payment_allocations', 'DELETE') then
    raise exception 'Clients must not be able to mutate financial allocations directly';
  end if;

  raise notice 'PASS: centralized allocations, unique platform fee, and buyer-confirmed release gates';
end;
$test$;


-- Exercise the complete financial gate against isolated fixture records.
do $behavior$
declare
  v_buyer uuid := '41000000-0000-0000-0000-000000000001';
  v_supplier uuid := '41000000-0000-0000-0000-000000000002';
  v_driver uuid := '41000000-0000-0000-0000-000000000003';
  v_product uuid := '42000000-0000-0000-0000-000000000001';
  v_pre_order uuid := '43000000-0000-0000-0000-000000000001';
  v_order uuid := '44000000-0000-0000-0000-000000000001';
  v_load uuid := '45000000-0000-0000-0000-000000000001';
  v_intent uuid := '46000000-0000-0000-0000-000000000001';
  v_total numeric(15,2);
  v_seller_amount numeric(15,2);
  v_driver_amount numeric(15,2);
  v_fee_amount numeric(15,2);
  v_blocked_count integer;
  v_available_count integer;
  v_payout_count integer;
begin
  insert into public.users(id) values (v_buyer),(v_supplier),(v_driver);
  insert into public.products(id,user_id) values (v_product,v_supplier);
  insert into public.pre_orders(id,product_id,user_id,status,payment_status,total_price)
  values (v_pre_order,v_product,v_buyer,'accepted','pending',1000);
  insert into public.orders(id,pre_order_id) values (v_order,v_pre_order);
  insert into public.freight_loads(
    id,created_by,driver_id,buyer_id,supplier_id,pre_order_id,order_id,
    status,driver_quote_status,offered_price,currency
  ) values (
    v_load,v_supplier,v_driver,v_buyer,v_supplier,v_pre_order,v_order,
    'in_transit','approved',100,'Kz'
  );
  insert into public.payment_intents(id,user_id,pre_order_id,amount,currency,purpose,status)
  values (v_intent,v_buyer,v_pre_order,1100,'AOA','order_payment','processing');

  -- A verified success creates three reconciled allocations, all blocked.
  update public.payment_intents set status='succeeded' where id=v_intent;
  update public.pre_orders set payment_status='paid' where id=v_pre_order;

  select
    round(sum(amount),2),
    round(sum(amount) filter (where allocation_type='seller'),2),
    round(sum(amount) filter (where allocation_type='driver'),2),
    round(sum(amount) filter (where allocation_type='platform_fee'),2),
    count(*) filter (where status='blocked')
  into v_total,v_seller_amount,v_driver_amount,v_fee_amount,v_blocked_count
  from public.payment_allocations
  where payment_intent_id=v_intent;

  if v_total <> 1100 or v_seller_amount <> 1000
     or v_driver_amount <> 92 or v_fee_amount <> 8
     or v_blocked_count <> 3 then
    raise exception 'Payment allocations do not reconcile or were not held: total %, seller %, driver %, fee %, blocked %',
      v_total,v_seller_amount,v_driver_amount,v_fee_amount,v_blocked_count;
  end if;

  -- Delivery without buyer confirmation must not release any allocation.
  update public.freight_loads
  set status='delivered',
      supplier_handover_confirmed_at=now(),
      driver_pickup_confirmed_at=now(),
      driver_delivery_confirmed_at=now()
  where id=v_load;

  if exists (
    select 1 from public.payment_allocations
    where payment_intent_id=v_intent and status <> 'blocked'
  ) or exists (select 1 from public.marketplace_payouts) then
    raise exception 'Driver delivery declaration released funds or created payout intents before buyer confirmation';
  end if;

  -- Persisted driver evidence plus buyer confirmation releases the allocations.
  insert into public.freight_delivery_evidence(id,freight_load_id,driver_id)
  values ('47000000-0000-0000-0000-000000000001',v_load,v_driver);

  update public.freight_loads
  set buyer_receipt_confirmed_at=now()
  where id=v_load;

  select count(*) into v_available_count
  from public.payment_allocations
  where payment_intent_id=v_intent and status='available';

  if v_available_count <> 3 then
    raise exception 'Buyer confirmation did not release all three reconciled allocations';
  end if;

  select count(*) into v_payout_count
  from public.marketplace_payouts mp
  where mp.status = 'awaiting_beneficiary_verification'
    and mp.amount in (1000,92)
    and mp.recipient_user_id in (v_supplier,v_driver);

  if v_payout_count <> 2 then
    raise exception 'Buyer confirmation must create separate supplier and driver payout intents awaiting beneficiary verification';
  end if;

  if exists (
    select 1 from public.marketplace_payouts
    where status = 'paid'
      and (paid_at is null or payout_reference is null)
  ) then
    raise exception 'Payouts cannot be marked paid without timestamp and transfer reference';
  end if;

  if not exists (
    select 1 from public.freight_settlements
    where freight_load_id=v_load and gross_amount=100
      and agrilink_commission=8 and driver_amount=92
  ) then
    raise exception 'Legacy driver settlement was not created consistently with the allocation ledger';
  end if;

  raise notice 'PASS: one AgriLink collection, blocked split, buyer-confirmed release and driver settlement';
end;
$behavior$;
