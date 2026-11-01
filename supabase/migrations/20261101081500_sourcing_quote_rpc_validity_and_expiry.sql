-- Keep the two AgriLink Sourcing interfaces on the same server-side lifecycle.
-- Adds quote validity to the validated RPC and supports explicit expiry decisions.

create or replace function public.create_sourcing_supplier_lead(
  p_company_name text,
  p_contact_name text,
  p_phone text,
  p_product_name text,
  p_province_id text default null,
  p_municipality_id text default null,
  p_locality text default null,
  p_source text default 'manual'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para registar fornecedores.';
  end if;
  if nullif(btrim(p_company_name), '') is null
     or nullif(btrim(p_phone), '') is null
     or nullif(btrim(p_product_name), '') is null then
    raise exception 'Empresa, telefone e produto são obrigatórios.';
  end if;
  if p_source is null or p_source not in ('manual', 'referral', 'marketplace', 'field_visit', 'other') then
    raise exception 'Origem do fornecedor inválida.';
  end if;

  insert into public.sourcing_supplier_leads(
    company_name, contact_name, phone, product_name, province_id,
    municipality_id, locality, source, verification_status
  ) values (
    btrim(p_company_name), nullif(btrim(p_contact_name), ''), btrim(p_phone),
    btrim(p_product_name), nullif(btrim(p_province_id), ''),
    nullif(btrim(p_municipality_id), ''), nullif(btrim(p_locality), ''),
    p_source, 'unverified'
  ) returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.create_sourcing_supplier_quote(uuid,uuid,numeric,text,numeric,text,date,text,text);

create function public.create_sourcing_supplier_quote(
  p_sourcing_request_id uuid,
  p_supplier_id uuid,
  p_available_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_currency text default 'AOA',
  p_expected_delivery_date date default null,
  p_quality_notes text default null,
  p_notes text default null,
  p_valid_until date default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_status text;
  v_request_product text;
  v_request_unit text;
  v_quote_id uuid;
  v_today date := (now() at time zone 'Africa/Luanda')::date;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para gerir sourcing.';
  end if;
  if p_available_quantity is null or p_available_quantity <= 0 then
    raise exception 'A quantidade disponível deve ser superior a zero.';
  end if;
  if p_unit is null or p_unit not in ('kg', 'tonelada', 'saco', 'caixa', 'unidade') then
    raise exception 'Unidade inválida.';
  end if;
  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'O preço unitário deve ser superior a zero.';
  end if;
  if p_currency is null or p_currency not in ('AOA', 'USD', 'EUR') then
    raise exception 'Moeda inválida.';
  end if;
  if p_expected_delivery_date is not null and p_expected_delivery_date < v_today then
    raise exception 'A data prevista de entrega não pode estar no passado.';
  end if;
  if p_valid_until is not null and p_valid_until < v_today then
    raise exception 'A validade da cotação não pode estar no passado.';
  end if;

  select status, product_name, unit
    into v_request_status, v_request_product, v_request_unit
  from public.sourcing_requests
  where id = p_sourcing_request_id
  for update;
  if not found then raise exception 'Pedido de sourcing não encontrado.'; end if;
  if p_unit <> v_request_unit then
    raise exception 'A unidade da cotação deve corresponder à unidade do pedido.';
  end if;
  if not exists (
    select 1
    from public.sourcing_supplier_leads s
    where s.id = p_supplier_id
      and s.verification_status = 'confirmed'
      and lower(btrim(s.product_name)) = lower(btrim(v_request_product))
  ) then
    raise exception 'O fornecedor deve estar confirmado e corresponder ao produto solicitado.';
  end if;
  if v_request_status in ('approved', 'fulfilled', 'cancelled') then
    raise exception 'Não é possível cotar um pedido aprovado, concluído ou cancelado.';
  end if;

  insert into public.sourcing_supplier_quotes (
    sourcing_request_id, supplier_id, available_quantity, unit, unit_price,
    currency, quality_notes, availability_status, confirmation_status,
    expected_delivery_date, valid_until, notes
  ) values (
    p_sourcing_request_id, p_supplier_id, p_available_quantity, p_unit, p_unit_price,
    p_currency, nullif(trim(p_quality_notes), ''), 'not_checked', 'pending',
    p_expected_delivery_date, p_valid_until, nullif(trim(p_notes), '')
  ) returning id into v_quote_id;

  update public.sourcing_requests
  set status = 'quoted', updated_at = now()
  where id = p_sourcing_request_id;
  return v_quote_id;
end;
$$;

revoke all on function public.create_sourcing_supplier_quote(uuid,uuid,numeric,text,numeric,text,date,text,text,date) from public, anon;
grant execute on function public.create_sourcing_supplier_quote(uuid,uuid,numeric,text,numeric,text,date,text,text,date) to authenticated;

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
  v_today date := (now() at time zone 'Africa/Luanda')::date;
  v_evidence text;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para rever cotações de sourcing.';
  end if;
  if p_action is null or p_action not in ('confirm_availability', 'reject', 'expire') then
    raise exception 'Acção de revisão inválida.';
  end if;

  select * into v_quote
  from public.sourcing_supplier_quotes
  where id = p_quote_id
  for update;
  if not found then raise exception 'Cotação não encontrada.'; end if;

  if p_action = 'expire' then
    if v_quote.confirmation_status not in ('pending', 'confirmed') then
      raise exception 'Só é possível expirar uma cotação pendente ou confirmada.';
    end if;
    if v_quote.valid_until is null or v_quote.valid_until >= v_today then
      raise exception 'A cotação ainda está dentro da validade.';
    end if;
    if exists (select 1 from public.sourcing_purchases p where p.quote_id = p_quote_id) then
      raise exception 'A cotação já está associada a uma compra e não pode ser expirada.';
    end if;
    v_evidence := coalesce(nullif(btrim(p_evidence), ''), 'Validade terminada em ' || v_quote.valid_until::text || '.');
    v_notes := concat_ws(E'\\n\\n', nullif(btrim(v_quote.notes), ''), 'Expiração registada: ' || v_evidence);
    if char_length(v_notes) > 2000 then raise exception 'O histórico da cotação excede 2000 caracteres.'; end if;
    update public.sourcing_supplier_quotes
    set confirmation_status = 'expired',
        confirmed_by = null,
        confirmed_at = null,
        notes = v_notes,
        updated_at = now()
    where id = p_quote_id;
    return;
  end if;

  if v_quote.confirmation_status <> 'pending' then
    raise exception 'Só é possível rever uma cotação pendente.';
  end if;
  if nullif(btrim(p_evidence), '') is null then
    raise exception 'Registe a evidência ou o motivo da decisão.';
  end if;
  if char_length(p_evidence) > 1800 then
    raise exception 'A evidência excede o limite permitido.';
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
    if v_quote.valid_until is not null and v_quote.valid_until < v_today then
      raise exception 'A validade desta cotação terminou. Registe uma proposta actualizada.';
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
    v_notes := concat_ws(E'\\n\\n', nullif(btrim(v_quote.notes), ''), 'Verificação de disponibilidade (' || p_confirmation_method || '): ' || btrim(p_evidence));
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
    v_notes := concat_ws(E'\\n\\n', nullif(btrim(v_quote.notes), ''), 'Motivo de rejeição: ' || btrim(p_evidence));
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

notify pgrst, 'reload schema';
