begin;

do $test$
declare
  v_submit text;
  v_receipt text;
  v_viewer text;
  v_delivery_guard text;
  v_release text;
begin
  if to_regclass('public.freight_delivery_evidence') is null then
    raise exception 'private delivery evidence table is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.freight_loads'::regclass
      and tgname = 'trg_guard_freight_delivery_status'
      and not tgisinternal
  ) then
    raise exception 'freight delivery status must be guarded by evidence';
  end if;

  if to_regprocedure('public.submit_freight_delivery_evidence(uuid,text,text,text,double precision,double precision,double precision)') is null
     or to_regprocedure('public.confirm_freight_receipt(uuid)') is null
     or to_regprocedure('public.get_freight_delivery_evidence(uuid)') is null then
    raise exception 'delivery evidence and buyer receipt RPCs are incomplete';
  end if;

  if not has_function_privilege('authenticated', 'public.submit_freight_delivery_evidence(uuid,text,text,text,double precision,double precision,double precision)', 'EXECUTE')
     or has_function_privilege('anon', 'public.submit_freight_delivery_evidence(uuid,text,text,text,double precision,double precision,double precision)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.confirm_freight_receipt(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.confirm_freight_receipt(uuid)', 'EXECUTE') then
    raise exception 'delivery and receipt RPC grants are not correctly scoped';
  end if;

  select pg_get_functiondef('public.submit_freight_delivery_evidence(uuid,text,text,text,double precision,double precision,double precision)'::regprocedure)
    into v_submit;
  if position('v_load.driver_id is distinct from v_actor' in v_submit) = 0
     or position('v_load.status <> ''in_transit''' in v_submit) = 0
     or position('freight_delivery_evidence' in v_submit) = 0 then
    raise exception 'delivery evidence must be submitted by the assigned driver during transit';
  end if;

  select pg_get_functiondef('public.confirm_freight_receipt(uuid)'::regprocedure)
    into v_receipt;
  if position('v_load.buyer_id is distinct from v_actor' in v_receipt) = 0
     or position('v_load.status <> ''delivered''' in v_receipt) = 0
     or position('buyer_receipt_confirmed_at' in v_receipt) = 0
     or position('v_order.payment_status is distinct from ''paid''' in v_receipt) = 0 then
    raise exception 'only the buyer may confirm an evidenced, paid delivery';
  end if;

  select pg_get_functiondef('public.get_freight_delivery_evidence(uuid)'::regprocedure)
    into v_viewer;
  if position('v_actor in (v_load.buyer_id, v_load.supplier_id, v_load.driver_id, v_load.created_by)' in v_viewer) = 0 then
    raise exception 'delivery evidence must remain participant-only';
  end if;

  select pg_get_functiondef('public.guard_freight_delivery_status()'::regprocedure)
    into v_delivery_guard;
  if position('freight_delivery_evidence' in v_delivery_guard) = 0 then
    raise exception 'a load cannot be marked delivered without evidence';
  end if;

  select pg_get_functiondef('public.release_marketplace_allocations_after_buyer_receipt()'::regprocedure)
    into v_release;
  if position('buyer_receipt_confirmed_at' in v_release) = 0
     or position('available' in v_release) = 0 then
    raise exception 'marketplace allocations must be released only after buyer receipt';
  end if;
end;
$test$;

rollback;
