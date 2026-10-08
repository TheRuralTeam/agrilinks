create or replace function public.expire_p2p_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    update public.p2p_orders
    set status='expired', updated_at=now()
    where status in ('matching','offered','payment_pending')
      and expires_at <= now()
    returning id, status
  loop
    insert into public.p2p_transaction_events(
      p2p_order_id,event_type,from_status,to_status,actor_id,metadata,created_at
    )
    values(
      v_order.id,
      'expired',
      null,
      'expired',
      null,
      jsonb_build_object('reason','automatic_expiry','source','agrilink-expire-p2p-orders'),
      now()
    );
    v_count := v_count + 1;
  end loop;

  update public.payment_intents pi
  set status='expired',
      failure_code='P2P_ORDER_EXPIRED',
      updated_at=now()
  where pi.id in (
    select payment_intent_id
    from public.p2p_orders
    where status='expired'
      and updated_at >= now() - interval '10 minutes'
      and payment_intent_id is not null
  )
  and pi.status not in ('succeeded','refunded','expired');

  return v_count;
end;
$$;

revoke all on function public.expire_p2p_orders() from public, anon, authenticated;