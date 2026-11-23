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

  raise notice 'PASS: centralized allocations, unique platform fee, and buyer-confirmed release gates';
end;
$test$;
