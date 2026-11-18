-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008185236; original ledger name: 20261008185000_endurecer_expiracao_p2p.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE OR REPLACE FUNCTION public.expire_p2p_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id,status,payment_intent_id,pre_order_id
    from public.p2p_orders
    where status in ('matching','offered','payment_pending')
      and expires_at <= now()
    for update skip locked
  loop
    update public.p2p_orders set status='expired',updated_at=now() where id=v_order.id;

    if v_order.payment_intent_id is not null then
      update public.payment_intents
      set status='expired',
          failure_code='P2P_ORDER_EXPIRED',
          failure_message='A operação P2P expirou antes da conclusão.',
          updated_at=now()
      where id=v_order.payment_intent_id
        and status not in ('succeeded','refunded','expired');

      update public.payment_attempts
      set status='expired',
          failure_code='P2P_ORDER_EXPIRED',
          failure_message='A operação P2P expirou antes da conclusão.',
          updated_at=now()
      where payment_intent_id=v_order.payment_intent_id
        and status not in ('succeeded','failed','cancelled','expired');
    end if;

    insert into public.p2p_transaction_events(
      p2p_order_id,event_type,from_status,to_status,actor_id,metadata,created_at
    ) values(
      v_order.id,'p2p.order.expired',v_order.status,'expired',null,
      jsonb_build_object('reason','automatic_expiry','source','agrilink-expire-p2p-orders','payment_intent_id',v_order.payment_intent_id,'pre_order_id',v_order.pre_order_id),
      now()
    );

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_p2p_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_p2p_orders() TO service_role;
