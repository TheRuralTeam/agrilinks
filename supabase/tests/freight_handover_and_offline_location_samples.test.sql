-- Static contract checks for supplier handover and offline location ingestion.
begin;

do $$
declare
  v_count integer;
  v_def text;
begin
  if to_regclass('public.freight_handover_evidence') is null then
    raise exception 'freight_handover_evidence table is missing';
  end if;
  if to_regprocedure('public.submit_supplier_handover_evidence(uuid,text,numeric,text,text,text,double precision,double precision,double precision)') is null then
    raise exception 'supplier handover submission RPC is missing';
  end if;
  if to_regprocedure('public.confirm_supplier_handover_receipt(uuid)') is null then
    raise exception 'driver handover acknowledgement RPC is missing';
  end if;
  if to_regprocedure('public.record_freight_load_location_batch(uuid,uuid,jsonb)') is null then
    raise exception 'offline location batch RPC is missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='freight_location_history_event_uidx'
  ) then
    raise exception 'location event idempotency index is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname='trg_guard_freight_supplier_handover_transition'
      and not tgisinternal
  ) then
    raise exception 'server-side handover transition guard is missing';
  end if;
  select pg_get_functiondef('public.record_freight_load_location_batch(uuid,uuid,jsonb)'::regprocedure)
    into v_def;
  if position('30 days' in v_def)=0 or position('100 samples' in v_def)=0 then
    raise exception 'offline batch bounds are missing';
  end if;
  if has_function_privilege('anon','public.record_freight_load_location_batch(uuid,uuid,jsonb)','EXECUTE') then
    raise exception 'anonymous access to offline location RPC must be revoked';
  end if;
end;
$$;

rollback;
