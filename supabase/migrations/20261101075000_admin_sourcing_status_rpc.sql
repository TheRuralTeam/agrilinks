-- Preserve the legacy marketplace admin sourcing actions without granting table UPDATE.
-- "in_progress" is normalized to the current workflow state "reviewing".
create or replace function public.admin_update_sourcing_request_status(
  p_request_id uuid,
  p_status text,
  p_admin_notes text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
  v_normalized_current text;
  v_next_status text;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para gerir pedidos de sourcing.';
  end if;

  if p_status is null or p_status not in (
    'pending', 'in_progress', 'reviewing', 'quoted',
    'approved', 'fulfilled', 'completed', 'rejected', 'cancelled'
  ) then
    raise exception 'Estado de sourcing inválido.';
  end if;
  if p_admin_notes is not null and char_length(p_admin_notes) > 2000 then
    raise exception 'As notas administrativas excedem 2000 caracteres.';
  end if;

  select status into v_current_status
  from public.sourcing_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Pedido de sourcing não encontrado.'; end if;

  v_normalized_current := case when v_current_status = 'in_progress' then 'reviewing' else v_current_status end;
  v_next_status := case when p_status = 'in_progress' then 'reviewing' else p_status end;

  if v_next_status <> v_normalized_current then
    if v_normalized_current in ('approved', 'fulfilled', 'completed', 'rejected', 'cancelled') then
      raise exception 'O pedido está num estado terminal ou já tem uma compra aceite.';
    end if;

    if exists (
      select 1 from public.sourcing_purchases p
      where p.sourcing_request_id = p_request_id and p.status = 'ordered'
    ) then
      raise exception 'Este pedido tem uma compra activa. Actualize a compra e a entrega no fluxo de compras.';
    end if;

    if v_next_status = 'reviewing' and v_normalized_current <> 'pending' then
      raise exception 'Só é possível iniciar a análise de um pedido pendente.';
    end if;
    if v_next_status = 'pending' and v_normalized_current <> 'reviewing' then
      raise exception 'Só é possível devolver à pendência um pedido em análise.';
    end if;
    if v_next_status in ('completed', 'rejected') then
      if v_normalized_current not in ('pending', 'reviewing', 'quoted') then
        raise exception 'Este pedido não pode ser concluído ou rejeitado neste estado.';
      end if;
      if nullif(btrim(p_admin_notes), '') is null then
        raise exception 'Registe a evidência de conclusão ou o motivo da rejeição.';
      end if;
    end if;
    if v_next_status not in ('pending', 'reviewing', 'completed', 'rejected') then
      raise exception 'Este estado só pode ser alterado pelo fluxo comercial de sourcing.';
    end if;
  end if;

  update public.sourcing_requests
  set status = v_next_status,
      admin_notes = case when p_admin_notes is null then admin_notes else nullif(btrim(p_admin_notes), '') end,
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.admin_update_sourcing_request_status(uuid,text,text) from public, anon;
grant execute on function public.admin_update_sourcing_request_status(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
