-- Exigir evidência escrita e impedir cotações incompatíveis com o pedido.
alter table public.sourcing_supplier_leads
  drop constraint if exists sourcing_supplier_leads_confirmation_evidence_check;
alter table public.sourcing_supplier_leads
  add constraint sourcing_supplier_leads_confirmation_evidence_check
  check (
    verification_status <> 'confirmed'
    or (
      verified_at is not null
      and verified_by is not null
      and verification_notes is not null
      and char_length(trim(verification_notes)) > 0
    )
  );

create or replace function public.validate_sourcing_supplier_quote()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_product text;
  request_unit text;
  supplier_product text;
  supplier_status text;
begin
  select r.product_name, r.unit into request_product, request_unit
  from public.sourcing_requests r where r.id = new.sourcing_request_id;
  if not found then raise exception 'O pedido de sourcing indicado não existe.'; end if;

  select s.product_name, s.verification_status into supplier_product, supplier_status
  from public.sourcing_supplier_leads s where s.id = new.supplier_id;
  if not found then raise exception 'O fornecedor indicado não existe.'; end if;

  if supplier_status <> 'confirmed' then
    raise exception 'Só é possível registar cotações de fornecedores confirmados.';
  end if;
  if lower(trim(supplier_product)) <> lower(trim(request_product)) then
    raise exception 'O produto do fornecedor não corresponde ao produto pedido.';
  end if;
  if new.unit <> request_unit then
    raise exception 'A unidade da cotação deve ser igual à unidade do pedido para evitar comparações incorrectas.';
  end if;
  if new.confirmation_status = 'confirmed' and new.valid_until is not null and new.valid_until < current_date then
    raise exception 'Não é possível confirmar uma cotação cuja validade terminou.';
  end if;
  return new;
end;
$$;

drop trigger if exists sourcing_supplier_quotes_validate on public.sourcing_supplier_quotes;
create trigger sourcing_supplier_quotes_validate
before insert or update on public.sourcing_supplier_quotes
for each row execute function public.validate_sourcing_supplier_quote();

revoke all on function public.validate_sourcing_supplier_quote() from public, anon, authenticated;
