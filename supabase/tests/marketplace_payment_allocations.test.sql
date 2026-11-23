-- Structural regression tests for centralized marketplace allocations.
-- PSP network integration requires a configured sandbox; this suite exercises
-- the database lifecycle with isolated synthetic payment and delivery fixtures.

do $test$
declare
  v_recipient_nullable boolean;
  v_platform_fee_index boolean;
  v_payment_trigger boolean;
  v_release_trigger boolean;
  v_function_security_definer boolean;
  v_policy_exists boolean;
  v_payout_trigger boolean;
  v_payout_policy boolean;
  v_payout_rls boolean;
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

  select c.relrowsecurity
  into v_payout_rls
  from pg_class c
  where c.oid = 'public.marketplace_payouts'::regclass;

  if v_payout_rls is distinct from true then
    raise exception 'Marketplace payout intents must enforce row-level security';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_payouts'
      and policyname = 'Payout participants can read their payout status'
  ) into v_payout_policy;

  if not v_payout_policy then
    raise exception 'Only payout recipients and admins may read payout statuses';
  end if;

  if has_table_privilege('authenticated', 'public.marketplace_payouts', 'INSERT')
     or has_table_privilege('authenticated', 'public.marketplace_payouts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.marketplace_payouts', 'DELETE') then
    raise exception 'Clients must not mutate payout intents directly';
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

  -- The driver POD must exist before the delivered transition is accepted.
  insert into public.freight_delivery_evidence(id,freight_load_id,driver_id)
  values ('47000000-0000-0000-0000-000000000001',v_load,v_driver);

  -- Driver delivery declaration without buyer confirmation must not release any allocation.
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


-- Admin beneficiary review and manual payout state machine.
do $admin_payouts$
declare
  v_admin uuid := '41000000-0000-0000-0000-000000000099';
  v_supplier uuid := '41000000-0000-0000-0000-000000000002';
  v_driver uuid := '41000000-0000-0000-0000-000000000003';
  v_supplier_beneficiary uuid;
  v_driver_beneficiary uuid;
  v_supplier_payout uuid;
  v_driver_payout uuid;
begin
  insert into public.users(id) values(v_admin) on conflict do nothing;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('test.is_admin', 'true', true);

  if has_column_privilege('authenticated','public.marketplace_payout_beneficiaries','provider_beneficiary_ref','SELECT') then
    raise exception 'Provider beneficiary token must not be exposed through the client Data API';
  end if;

  if has_table_privilege('authenticated','public.marketplace_payout_audit','INSERT')
     or has_table_privilege('authenticated','public.marketplace_payout_audit','UPDATE')
     or has_table_privilege('authenticated','public.marketplace_payout_audit','DELETE') then
    raise exception 'Payout audit must be append-only through controlled backend functions';
  end if;

  select id into v_supplier_payout
  from public.marketplace_payouts where recipient_user_id=v_supplier;
  select id into v_driver_payout
  from public.marketplace_payouts where recipient_user_id=v_driver;

  if v_supplier_payout is null or v_driver_payout is null then
    raise exception 'Expected distinct supplier and driver payout intents';
  end if;

  v_supplier_beneficiary := public.admin_register_marketplace_payout_beneficiary(
    v_supplier,'bank_transfer','vault:beneficiary:supplier-01','Supplier Test','IBAN •••• 1024'
  );
  v_driver_beneficiary := public.admin_register_marketplace_payout_beneficiary(
    v_driver,'bank_transfer','vault:beneficiary:driver-01','Driver Test','IBAN •••• 2048'
  );

  perform public.admin_review_marketplace_payout_beneficiary(v_supplier_beneficiary,'verified',null);
  perform public.admin_review_marketplace_payout_beneficiary(v_driver_beneficiary,'verified',null);

  if (select status from public.marketplace_payouts where id=v_supplier_payout) <> 'awaiting_manual_payout'
     or (select status from public.marketplace_payouts where id=v_driver_payout) <> 'awaiting_manual_payout' then
    raise exception 'Verified beneficiary did not unlock the corresponding payout intents';
  end if;

  begin
    perform public.admin_transition_marketplace_payout(v_supplier_payout,'processing',null,null,null);
    perform public.admin_transition_marketplace_payout(v_supplier_payout,'paid',null,null,null);
    raise exception 'Paid transition unexpectedly accepted missing transfer evidence';
  exception when check_violation then
    null;
  end;

  insert into storage.objects(bucket_id,name)
  values('marketplace-payout-proofs',v_supplier_payout::text || '/proof/bank-confirmation.pdf');

  perform public.admin_transition_marketplace_payout(v_supplier_payout,'processing',null,null,null);
  perform public.admin_transition_marketplace_payout(
    v_supplier_payout,'paid','BANK-TRANSFER-TEST-001',
    v_supplier_payout::text || '/proof/bank-confirmation.pdf',null
  );

  if (select status from public.marketplace_payouts where id=v_supplier_payout) <> 'paid'
     or (select paid_at from public.marketplace_payouts where id=v_supplier_payout) is null
     or (select paid_by from public.marketplace_payouts where id=v_supplier_payout) <> v_admin then
    raise exception 'Paid payout lacks required audit fields';
  end if;

  perform public.admin_transition_marketplace_payout(v_driver_payout,'processing',null,null,null);
  perform public.admin_transition_marketplace_payout(v_driver_payout,'failed',null,null,'Bank transfer rejected');
  perform public.admin_transition_marketplace_payout(v_driver_payout,'retry',null,null,null);
  if (select status from public.marketplace_payouts where id=v_driver_payout) <> 'awaiting_manual_payout' then
    raise exception 'Failed payout retry did not return to manual payout queue';
  end if;

  raise notice 'PASS: beneficiary review, restricted token visibility, separate payout processing, evidence-gated paid state and retry';
end;
$admin_payouts$;
