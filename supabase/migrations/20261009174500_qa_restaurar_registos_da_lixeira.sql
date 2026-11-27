-- QA: permitir retirar uma pré-compra da lixeira dentro do prazo de 15 dias.
-- Restaura apenas o registo administrativo; não reabre estados finais nem reserva
-- stock automaticamente. A função valida permissões e bloqueia operações financeiras activas.

create or replace function public.admin_restore_pre_order(p_order_id uuid)
returns table(id uuid, status text, deleted_at timestamptz, deleted_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_order public.pre_orders%rowtype;
begin
  if v_actor is null or not (
    public.has_admin_permission(v_actor, 'manage_orders'::public.admin_permission)
    or public.is_support_agent(v_actor)
  ) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'Pre-order id is required' using errcode = '22023';
  end if;

  select po.*
  into v_order
  from public.pre_orders po
  where po.id = p_order_id
  for update;

  if not found then
    raise exception 'Pre-order not found' using errcode = 'P0002';
  end if;

  if v_order.deleted_at is null then
    raise exception 'PRE_ORDER_NOT_IN_TRASH' using errcode = '22023';
  end if;

  if v_order.deleted_until is null or v_order.deleted_until <= now() then
    raise exception 'PRE_ORDER_TRASH_RETENTION_EXPIRED' using errcode = '22023';
  end if;

  if v_order.payment_status in ('paid', 'pending', 'partially_refunded')
    or exists (
      select 1 from public.payment_intents pi
      where pi.pre_order_id = p_order_id
        and pi.status in ('created', 'pending', 'processing', 'succeeded', 'refunded')
    ) then
    raise exception 'FINANCIAL_ORDER_CANNOT_BE_RESTORED_FROM_TRASH' using errcode = '22023';
  end if;

  update public.pre_orders po
  set deleted_at = null,
      deleted_until = null,
      deleted_by = null,
      deletion_reason = null,
      updated_at = now()
  where po.id = p_order_id
  returning * into v_order;

  insert into public.audit_logs(event_type, action, user_id, details)
  values (
    'PRE_ORDER_RESTORED_FROM_TRASH',
    'ADMIN_PRE_ORDER_RESTORED',
    v_actor,
    jsonb_build_object(
      'pre_order_id', p_order_id,
      'previous_status', v_order.status,
      'restored_at', now()
    )
  );

  return query select v_order.id, v_order.status::text, v_order.deleted_at, v_order.deleted_until;
end;
$function$;

revoke all on function public.admin_restore_pre_order(uuid) from public, anon;
grant execute on function public.admin_restore_pre_order(uuid) to authenticated;
