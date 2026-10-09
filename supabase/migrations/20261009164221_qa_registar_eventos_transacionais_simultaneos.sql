-- QA: garantir que todas as alterações transacionais simultâneas ficam no histórico.
-- Mantém os triggers existentes e substitui apenas as funções por versões que registam
-- cada campo alterado de forma independente, sem apagar eventos anteriores.

create or replace function public.log_pre_order_transaction_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_order_transaction_event(
      'pre_order_created', new.id, null, null, null, new.status, new.user_id,
      jsonb_build_object('source', 'pre_orders')
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.record_order_transaction_event(
      'pre_order_status_changed', new.id, null, null, old.status, new.status,
      coalesce(auth.uid(), new.user_id),
      jsonb_build_object('source', 'pre_orders')
    );
  end if;

  if new.payment_status is distinct from old.payment_status then
    perform public.record_order_transaction_event(
      'payment_status_changed', new.id, null, null, old.payment_status, new.payment_status,
      coalesce(auth.uid(), new.user_id),
      jsonb_build_object('source', 'pre_orders')
    );
  end if;

  return new;
end;
$$;

create or replace function public.log_order_transaction_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_order_transaction_event(
      'order_created', new.pre_order_id, new.id, null, null, new.status, new.user_id,
      jsonb_build_object('source', 'orders')
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.record_order_transaction_event(
      'order_status_changed', new.pre_order_id, new.id, null, old.status, new.status,
      coalesce(auth.uid(), new.user_id),
      jsonb_build_object('source', 'orders')
    );
  end if;

  if new.payment_status is distinct from old.payment_status then
    perform public.record_order_transaction_event(
      'order_payment_status_changed', new.pre_order_id, new.id, null,
      old.payment_status, new.payment_status, coalesce(auth.uid(), new.user_id),
      jsonb_build_object('source', 'orders')
    );
  end if;

  return new;
end;
$$;

create or replace function public.log_freight_transaction_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_order_transaction_event(
      'freight_created', new.pre_order_id, new.order_id, new.id, null, new.status,
      new.created_by, jsonb_build_object('source', 'freight_loads')
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.record_order_transaction_event(
      'freight_status_changed', new.pre_order_id, new.order_id, new.id,
      old.status, new.status, coalesce(auth.uid(), new.driver_id, new.created_by),
      jsonb_build_object('source', 'freight_loads')
    );
  end if;

  if new.driver_id is distinct from old.driver_id and new.driver_id is not null then
    perform public.record_order_transaction_event(
      'driver_assigned', new.pre_order_id, new.order_id, new.id, null, new.status,
      new.driver_id, jsonb_build_object('source', 'freight_loads')
    );
  end if;

  return new;
end;
$$;

revoke all on function public.log_pre_order_transaction_event() from public, anon, authenticated;
revoke all on function public.log_order_transaction_event() from public, anon, authenticated;
revoke all on function public.log_freight_transaction_event() from public, anon, authenticated;
