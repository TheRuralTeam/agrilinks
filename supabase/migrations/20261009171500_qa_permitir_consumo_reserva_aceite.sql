-- QA crítico: permitir que o ciclo de vida consuma uma reserva após a aceitação.
-- O guard anterior bloqueava stock_reserved=true -> false em pedidos aceites,
-- impedindo o trigger consume_marketplace_reservation de concluir a transição.
-- Também reconcilia registos antigos afectados, sem repor stock livre.

create or replace function public.guard_pre_order_cancellation_during_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_product public.products%rowtype;
begin
  if new.product_id is distinct from old.product_id
    or new.quantity is distinct from old.quantity then
    raise exception 'A pre-order product and quantity cannot be changed after submission'
      using errcode = '22023';
  end if;

  if new.stock_reserved is distinct from old.stock_reserved
    and not (
      (old.status is distinct from 'accepted' and new.status = 'accepted' and new.stock_reserved = true)
      or (new.status in ('cancelled','rejected','expired') and old.stock_reserved = true and new.stock_reserved = false)
      or (old.status in ('accepted','completed') and new.status = old.status
          and old.stock_reserved = true and new.stock_reserved = false)
    ) then
    raise exception 'Stock reservation is managed by the order lifecycle'
      using errcode = '22023';
  end if;

  if old.status in ('rejected', 'cancelled', 'completed', 'concluida', 'cancelado')
    and new.status is distinct from old.status then
    raise exception 'Final pre-orders cannot be reopened'
      using errcode = '22023';
  end if;

  if old.status = 'accepted' and new.status in ('pending', 'aguardando') then
    raise exception 'An accepted pre-order cannot return to a pending state'
      using errcode = '22023';
  end if;

  if old.status is distinct from 'accepted' and new.status = 'accepted'
    and not old.stock_reserved then
    select * into v_product
    from public.products
    where id = new.product_id
    for update;

    if not found or v_product.status <> 'active' then
      raise exception 'Product is no longer available'
        using errcode = '22023';
    end if;

    if new.quantity > v_product.quantity then
      raise exception 'Requested quantity exceeds remaining product stock'
        using errcode = '22023';
    end if;

    update public.products
    set quantity = quantity - new.quantity,
        reserved_quantity = coalesce(reserved_quantity,0) + new.quantity,
        updated_at = now()
    where id = new.product_id;

    new.stock_reserved := true;
  end if;

  if old.status = 'accepted' and new.status in ('cancelled', 'rejected')
    and exists (
      select 1
      from public.freight_loads
      where pre_order_id = old.id
        and status in ('in_transit', 'delivered')
    ) then
    raise exception 'An order cannot be cancelled after GPS transport has started'
      using errcode = '22023';
  end if;

  if new.status in ('cancelled', 'rejected', 'expired')
    and old.stock_reserved then
    new.stock_reserved := false;
  end if;

  return new;
end;
$function$;

do $$
declare
  v_row record;
begin
  for v_row in
    select po.id, po.product_id, po.quantity
    from public.pre_orders po
    where po.status in ('accepted', 'completed')
      and po.stock_reserved is true
    order by po.product_id, po.id
    for update
  loop
    update public.products p
    set reserved_quantity = greatest(coalesce(p.reserved_quantity, 0) - v_row.quantity, 0),
        updated_at = now()
    where p.id = v_row.product_id;

    update public.pre_orders po
    set stock_reserved = false,
        reservation_expires_at = null,
        updated_at = now()
    where po.id = v_row.id
      and po.stock_reserved is true
      and po.status in ('accepted', 'completed');
  end loop;
end;
$$;
