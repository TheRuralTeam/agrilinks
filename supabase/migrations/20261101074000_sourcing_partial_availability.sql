-- Record partial stock truthfully; purchase acceptance still requires full requested quantity.
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
  v_request_quantity numeric;
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

  select r.status, r.product_name, r.unit, r.quantity, s.verification_status, s.product_name
    into v_request_status, v_request_product, v_request_unit, v_request_quantity, v_supplier_status, v_supplier_product
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
    set availability_status = case when v_quote.available_quantity < v_request_quantity then 'partially_available' else 'available' end,
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
;
notify pgrst, 'reload schema';
