-- Keep the accepted quote state consistent when an accepted purchase is cancelled.
create or replace function public.update_sourcing_purchase_status(p_purchase_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $body$
declare
  v_request_id uuid;
  v_quote_id uuid;
  v_current_status text;
  v_rows integer;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para actualizar compras de sourcing.';
  end if;
  if p_status is null or p_status not in ('ordered', 'delivered', 'cancelled') then
    raise exception 'Estado da compra inválido.';
  end if;
  select sourcing_request_id, quote_id, status into v_request_id, v_quote_id, v_current_status
  from public.sourcing_purchases where id = p_purchase_id for update;
  if not found then raise exception 'Compra não encontrada.'; end if;
  if v_current_status in ('delivered', 'cancelled') and p_status <> v_current_status then
    raise exception 'Uma compra entregue ou cancelada é terminal e não pode ser reaberta.';
  end if;
  if v_current_status = p_status then
    return;
  end if;
  if p_status in ('delivered', 'cancelled') and nullif(btrim(p_notes), '') is null then
    raise exception 'Registe a prova de entrega ou o motivo do cancelamento.';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'O registo da operação excede 2000 caracteres.';
  end if;

  update public.sourcing_purchases
  set status = p_status,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else null end,
      notes = coalesce(nullif(btrim(p_notes), ''), notes),
      updated_at = now()
  where id = p_purchase_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Não foi possível actualizar a compra. Verifique as permissões.'; end if;

  if p_status = 'delivered' then
    update public.sourcing_requests set status = 'fulfilled', updated_at = now() where id = v_request_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Compra actualizada, mas não foi possível concluir o pedido. Operação revertida.'; end if;
  elsif p_status = 'cancelled' then
    update public.sourcing_supplier_quotes set confirmation_status = 'rejected', updated_at = now()
    where id = v_quote_id;
    update public.sourcing_requests set status = 'quoted', updated_at = now()
    where id = v_request_id and status = 'approved';
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Compra cancelada, mas o pedido não estava aprovado. Operação revertida.'; end if;
  end if;
end;
$body$;

revoke all on function public.update_sourcing_purchase_status(uuid, text, text) from public, anon;
grant execute on function public.update_sourcing_purchase_status(uuid, text, text) to authenticated;
