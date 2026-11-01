-- Enforce the Sourcing lifecycle through validated server-side RPCs.
-- Direct client writes to supplier, quote, purchase and request-status tables are disabled.
-- Buyers and sourcing managers retain the read and request-creation access required by the UI.

alter function public.create_sourcing_supplier_lead(text,text,text,text,text,text,text,text) security definer;
alter function public.create_sourcing_supplier_lead(text,text,text,text,text,text,text,text) set search_path = '';
alter function public.set_sourcing_supplier_verification(uuid,text,text) security definer;
alter function public.set_sourcing_supplier_verification(uuid,text,text) set search_path = '';
alter function public.update_sourcing_request_status(uuid,text) security definer;
alter function public.update_sourcing_request_status(uuid,text) set search_path = '';
alter function public.create_sourcing_supplier_quote(uuid,uuid,numeric,text,numeric,text,date,text,text) security definer;
alter function public.create_sourcing_supplier_quote(uuid,uuid,numeric,text,numeric,text,date,text,text) set search_path = '';
alter function public.accept_sourcing_supplier_quote(uuid) security definer;
alter function public.accept_sourcing_supplier_quote(uuid) set search_path = '';
alter function public.update_sourcing_purchase_status(uuid,text,text) security definer;
alter function public.update_sourcing_purchase_status(uuid,text,text) set search_path = '';

create or replace function public.update_sourcing_supplier_quote_review(
  p_quote_id uuid,
  p_action text,
  p_confirmation_method text default null,
  p_evidence text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.sourcing_supplier_quotes%rowtype;
  v_request_status text;
  v_request_product text;
  v_supplier_status text;
  v_supplier_product text;
  v_request_unit text;
  v_notes text;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para rever cotações de sourcing.';
  end if;

  if p_action is null or p_action not in ('confirm_availability', 'reject') then
    raise exception 'Acção de revisão inválida.';
  end if;
  if nullif(btrim(p_evidence), '') is null then
    raise exception 'Registe a evidência ou o motivo da decisão.';
  end if;
  if char_length(p_evidence) > 1800 then
    raise exception 'A evidência excede o limite permitido.';
  end if;

  select * into v_quote
  from public.sourcing_supplier_quotes
  where id = p_quote_id
  for update;
  if not found then raise exception 'Cotação não encontrada.'; end if;
  if v_quote.confirmation_status <> 'pending' then
    raise exception 'Só é possível rever uma cotação pendente.';
  end if;

  select r.status, r.product_name, r.unit, s.verification_status, s.product_name
    into v_request_status, v_request_product, v_request_unit, v_supplier_status, v_supplier_product
  from public.sourcing_requests r
  join public.sourcing_supplier_leads s on s.id = v_quote.supplier_id
  where r.id = v_quote.sourcing_request_id
  for update of r;
  if not found then raise exception 'Pedido ou fornecedor associado não encontrado.'; end if;
  if v_request_status in ('approved', 'fulfilled', 'cancelled') then
    raise exception 'O pedido já não aceita alterações às propostas.';
  end if;

  if p_action = 'confirm_availability' then
    if p_confirmation_method is null
       or p_confirmation_method not in ('phone', 'in_person', 'marketplace', 'document', 'other') then
      raise exception 'Método de confirmação inválido.';
    end if;
    if v_supplier_status <> 'confirmed'
       or lower(btrim(v_supplier_product)) <> lower(btrim(v_request_product)) then
      raise exception 'O fornecedor tem de estar confirmado e corresponder ao produto solicitado.';
    end if;
    if v_quote.unit <> v_request_unit then
      raise exception 'A unidade da cotação não corresponde à unidade do pedido.';
    end if;
    if v_quote.available_quantity <= 0 or v_quote.unit_price is null or v_quote.unit_price <= 0 then
      raise exception 'A cotação precisa de quantidade e preço válidos.';
    end if;
    v_notes := concat_ws(E'\n\n', nullif(btrim(v_quote.notes), ''), 'Verificação de disponibilidade (' || p_confirmation_method || '): ' || btrim(p_evidence));
    if char_length(v_notes) > 2000 then raise exception 'O histórico da cotação excede 2000 caracteres.'; end if;
    update public.sourcing_supplier_quotes
    set availability_status = 'available',
        confirmation_method = p_confirmation_method,
        confirmed_by = auth.uid(),
        confirmed_at = now(),
        notes = v_notes,
        updated_at = now()
    where id = p_quote_id;
  else
    v_notes := concat_ws(E'\n\n', nullif(btrim(v_quote.notes), ''), 'Motivo de rejeição: ' || btrim(p_evidence));
    if char_length(v_notes) > 2000 then raise exception 'O histórico da cotação excede 2000 caracteres.'; end if;
    update public.sourcing_supplier_quotes
    set confirmation_status = 'rejected',
        notes = v_notes,
        updated_at = now()
    where id = p_quote_id;
  end if;
end;
$$;

revoke all on function public.update_sourcing_supplier_quote_review(uuid,text,text,text) from public, anon;
grant execute on function public.update_sourcing_supplier_quote_review(uuid,text,text,text) to authenticated;

drop policy if exists "Sourcing admins manage purchases" on public.sourcing_purchases;
create policy "Sourcing managers read purchases"
on public.sourcing_purchases for select to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);

drop policy if exists "Sourcing admins manage supplier leads" on public.sourcing_supplier_leads;
create policy "Sourcing managers read supplier leads"
on public.sourcing_supplier_leads for select to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);

drop policy if exists "Sourcing admins manage supplier quotes" on public.sourcing_supplier_quotes;
create policy "Sourcing managers read supplier quotes"
on public.sourcing_supplier_quotes for select to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);

drop policy if exists "Admins podem atualizar pedidos de sourcing" on public.sourcing_requests;
drop policy if exists "Sourcing managers can update requests" on public.sourcing_requests;
drop policy if exists "Sourcing managers update sourcing requests" on public.sourcing_requests;

revoke insert, update, delete, truncate, references, trigger on public.sourcing_supplier_leads from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.sourcing_supplier_quotes from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.sourcing_purchases from anon, authenticated;
revoke update, delete, truncate, references, trigger on public.sourcing_requests from anon, authenticated;
grant select on public.sourcing_supplier_leads, public.sourcing_supplier_quotes, public.sourcing_purchases, public.sourcing_requests to authenticated;
grant insert on public.sourcing_requests to authenticated;

revoke all on function public.create_sourcing_supplier_lead(text,text,text,text,text,text,text,text) from public, anon;
revoke all on function public.set_sourcing_supplier_verification(uuid,text,text) from public, anon;
revoke all on function public.update_sourcing_request_status(uuid,text) from public, anon;
revoke all on function public.create_sourcing_supplier_quote(uuid,uuid,numeric,text,numeric,text,date,text,text) from public, anon;
revoke all on function public.accept_sourcing_supplier_quote(uuid) from public, anon;
revoke all on function public.update_sourcing_purchase_status(uuid,text,text) from public, anon;
grant execute on function public.create_sourcing_supplier_lead(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.set_sourcing_supplier_verification(uuid,text,text) to authenticated;
grant execute on function public.update_sourcing_request_status(uuid,text) to authenticated;
grant execute on function public.create_sourcing_supplier_quote(uuid,uuid,numeric,text,numeric,text,date,text,text) to authenticated;
grant execute on function public.accept_sourcing_supplier_quote(uuid) to authenticated;
grant execute on function public.update_sourcing_purchase_status(uuid,text,text) to authenticated;
