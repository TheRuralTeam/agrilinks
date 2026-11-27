begin;

do $$
declare
  v_definition text;
  v_allocation_definition text;
  v_settlement_definition text;
begin
  select pg_get_functiondef('public.get_marketplace_checkout_summary(uuid)'::regprocedure)
    into v_definition;

  if position('driver_quote_status = ''approved''' in v_definition) = 0
     or position('driver_offered_price' in v_definition) = 0
     or position('payment_authorized_recipients' in v_definition) > 0
     or position('agrilink_authorized_recipient' in v_definition) = 0
     or position('v_provider_ready := false' in v_definition) = 0 then
    raise exception 'checkout readiness must require an approved driver quote and a live AgriLink provider only';
  end if;

  select pg_get_functiondef('public.create_marketplace_payment_allocations()'::regprocedure)
    into v_allocation_definition;

  if position('LIVE_AGRILINK_PAYMENT_PROVIDER_REQUIRED' in v_allocation_definition) = 0
     or position('driver_offered_price' in v_allocation_definition) = 0
     or position('driver_quote_status' in v_allocation_definition) = 0 then
    raise exception 'payment allocation must require a live provider and use the approved driver quote';
  end if;

  select pg_get_functiondef('public.create_freight_settlement_if_ready(uuid)'::regprocedure)
    into v_settlement_definition;

  if position('driver_offered_price' in v_settlement_definition) = 0
     or position('driver_quote_status' in v_settlement_definition) = 0 then
    raise exception 'freight settlement must use the approved driver quote';
  end if;
end;
$$;

rollback;
