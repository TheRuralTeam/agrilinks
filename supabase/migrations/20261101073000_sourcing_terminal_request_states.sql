-- Treat legacy completed/rejected requests as terminal throughout the Sourcing lifecycle.
-- Keep quote creation, review, acceptance and manual status transitions consistent.

CREATE OR REPLACE FUNCTION public.create_sourcing_supplier_quote(p_sourcing_request_id uuid, p_supplier_id uuid, p_available_quantity numeric, p_unit text, p_unit_price numeric, p_currency text DEFAULT 'AOA'::text, p_expected_delivery_date date DEFAULT NULL::date, p_quality_notes text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_valid_until date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_request_status not in ('pending', 'reviewing', 'quoted') then
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
$function$


CREATE OR REPLACE FUNCTION public.update_sourcing_supplier_quote_review(p_quote_id uuid, p_action text, p_confirmation_method text DEFAULT NULL::text, p_evidence text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select status into v_request_status
    from public.sourcing_requests
    where id = v_quote.sourcing_request_id
    for update;
    if not found then raise exception 'Pedido de sourcing não encontrado.'; end if;
    if v_request_status not in ('pending', 'reviewing', 'quoted') then
      raise exception 'O pedido já não aceita alterações às propostas.';
    end if;
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
    v_notes := concat_ws(E'\n\n', nullif(btrim(v_quote.notes), ''), 'Expiração registada: ' || v_evidence);
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
  if v_request_status not in ('pending', 'reviewing', 'quoted') then
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
$function$


CREATE OR REPLACE FUNCTION public.accept_sourcing_supplier_quote(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_quote public.sourcing_supplier_quotes%rowtype;
  v_request_status text;
  v_purchase_id uuid;
  v_today date := (now() at time zone 'Africa/Luanda')::date;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para aceitar cotações de sourcing.';
  end if;

  select * into v_quote
  from public.sourcing_supplier_quotes
  where id = p_quote_id
  for update;
  if not found then raise exception 'Cotação não encontrada.'; end if;
  if v_quote.confirmation_status not in ('pending', 'confirmed') then
    raise exception 'Esta cotação não pode ser aceite no estado atual.';
  end if;
  if v_quote.unit_price is null or v_quote.unit_price <= 0 then raise exception 'A cotação não tem preço válido confirmado.'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until < v_today then
    raise exception 'A validade desta cotação terminou. Solicite uma proposta actualizada.';
  end if;
  if v_quote.availability_status not in ('available', 'partially_available')
     or v_quote.confirmation_method is null
     or v_quote.confirmation_method not in ('phone', 'in_person', 'marketplace', 'document', 'other') then
    raise exception 'Confirme e registe o método de verificação da disponibilidade antes de aceitar.';
  end if;

  select status into v_request_status
  from public.sourcing_requests
  where id = v_quote.sourcing_request_id
  for update;
  if not found then raise exception 'Pedido de sourcing não encontrado.'; end if;

  if not exists (
    select 1
    from public.sourcing_supplier_leads s
    join public.sourcing_requests r on r.id = v_quote.sourcing_request_id
    where s.id = v_quote.supplier_id
      and s.verification_status = 'confirmed'
      and lower(btrim(s.product_name)) = lower(btrim(r.product_name))
  ) then
    raise exception 'O fornecedor deixou de estar confirmado ou já não corresponde ao produto pedido.';
  end if;
  if v_quote.unit <> (select r.unit from public.sourcing_requests r where r.id = v_quote.sourcing_request_id) then
    raise exception 'A unidade da cotação não corresponde à unidade do pedido.';
  end if;
  if v_request_status not in ('pending', 'reviewing', 'quoted') then
    raise exception 'O pedido já não aceita compras.';
  end if;

  if v_quote.available_quantity < (select quantity from public.sourcing_requests where id = v_quote.sourcing_request_id) then
    raise exception 'A quantidade disponível é inferior à quantidade pedida. Registe uma cotação que cubra o pedido completo.';
  end if;

  insert into public.sourcing_purchases (
    sourcing_request_id, quote_id, supplier_id, quantity, unit, unit_price, currency, ordered_by
  ) values (
    v_quote.sourcing_request_id, v_quote.id, v_quote.supplier_id,
    (select quantity from public.sourcing_requests where id = v_quote.sourcing_request_id),
    v_quote.unit, v_quote.unit_price, v_quote.currency, auth.uid()
  ) returning id into v_purchase_id;

  update public.sourcing_supplier_quotes
  set confirmation_status = 'confirmed',
      availability_status = case when availability_status = 'not_checked' then 'available' else availability_status end,
      confirmed_by = auth.uid(), confirmed_at = now(), updated_at = now()
  where id = v_quote.id;

  update public.sourcing_requests set status = 'approved', updated_at = now()
  where id = v_quote.sourcing_request_id;
  return v_purchase_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.update_sourcing_request_status(p_request_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_current_status text;
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para actualizar pedidos de sourcing.';
  end if;
  if p_status is null or p_status not in ('pending', 'reviewing', 'cancelled') then
    raise exception 'Estado manual do pedido inválido. As etapas cotado, aprovado e concluído são controladas pelo fluxo comercial.';
  end if;
  select status into v_current_status
  from public.sourcing_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Pedido de sourcing não encontrado.'; end if;
  if v_current_status in ('approved', 'fulfilled', 'completed', 'cancelled', 'rejected') then
    raise exception 'O pedido está num estado terminal ou já tem uma compra aceite.';
  end if;
  if p_status = 'pending' and v_current_status <> 'reviewing' then
    raise exception 'Só é possível devolver um pedido em análise para pendente.';
  end if;
  if p_status = 'reviewing' and v_current_status not in ('pending', 'quoted', 'reviewing') then
    raise exception 'Transição de estado não permitida.';
  end if;
  if p_status = 'cancelled' and exists (
    select 1 from public.sourcing_purchases p
    where p.sourcing_request_id = p_request_id and p.status = 'ordered'
  ) then
    raise exception 'Cancele primeiro a compra activa antes de cancelar o pedido.';
  end if;
  update public.sourcing_requests
  set status = p_status, updated_at = now()
  where id = p_request_id;
end;
$function$


notify pgrst, 'reload schema';
