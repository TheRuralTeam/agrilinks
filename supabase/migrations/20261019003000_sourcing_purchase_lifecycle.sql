-- Sourcing workflow aligned with the live schema: sourcing_supplier_quotes + supplier leads.
-- Additive only. Deploy to a staging project and run concurrency/RLS tests before production.
begin;

create table if not exists public.sourcing_purchases (
  id uuid primary key default gen_random_uuid(),
  sourcing_request_id uuid not null references public.sourcing_requests(id) on delete restrict,
  quote_id uuid not null unique references public.sourcing_supplier_quotes(id) on delete restrict,
  supplier_id uuid not null references public.sourcing_supplier_leads(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (unit in ('kg', 'tonelada', 'saco', 'caixa', 'unidade')),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  currency text not null check (currency in ('AOA', 'USD', 'EUR')),
  status text not null default 'ordered' check (status in ('ordered', 'delivered', 'cancelled')),
  ordered_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  ordered_at timestamptz not null default now(),
  delivered_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'delivered' and delivered_at is not null) or status <> 'delivered')
);

create index if not exists idx_sourcing_purchases_request on public.sourcing_purchases(sourcing_request_id, created_at desc);
create index if not exists idx_sourcing_purchases_status on public.sourcing_purchases(status, created_at desc);
create unique index if not exists sourcing_purchases_one_active_per_request_idx
  on public.sourcing_purchases(sourcing_request_id) where status <> 'cancelled';

alter table public.sourcing_purchases enable row level security;
drop policy if exists "Sourcing admins manage purchases" on public.sourcing_purchases;
create policy "Sourcing admins manage purchases" on public.sourcing_purchases for all to authenticated
using (public.is_agrilink_admin() or public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission))
with check (public.is_agrilink_admin() or public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission));
revoke all on public.sourcing_purchases from anon;
grant select, insert, update on public.sourcing_purchases to authenticated;

-- The dashboard creates requests on behalf of a selected, existing AgriLink user.
-- Keep ordinary buyer self-service inserts governed by the existing owner policy.
drop policy if exists "Sourcing managers create requests on behalf of users" on public.sourcing_requests;
create policy "Sourcing managers create requests on behalf of users"
on public.sourcing_requests for insert to authenticated
with check (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);

revoke all on function public.audit_sourcing_supplier_quote() from public, anon, authenticated;

create or replace function public.create_sourcing_supplier_quote(
  p_sourcing_request_id uuid,
  p_supplier_id uuid,
  p_available_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_currency text default 'AOA',
  p_expected_delivery_date date default null,
  p_quality_notes text default null,
  p_notes text default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_request_status text;
  v_request_product text;
  v_quote_id uuid;
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
  select status, product_name
    into v_request_status, v_request_product
  from public.sourcing_requests
  where id = p_sourcing_request_id
  for update;
  if not found then raise exception 'Pedido de sourcing não encontrado.'; end if;

  if p_unit <> (select r.unit from public.sourcing_requests r where r.id = p_sourcing_request_id) then
    raise exception 'A unidade da cotação deve corresponder à unidade do pedido.';
  end if;
  if p_expected_delivery_date is not null and p_expected_delivery_date < current_date then
    raise exception 'A data prevista de entrega não pode estar no passado.';
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
    expected_delivery_date, notes
  ) values (
    p_sourcing_request_id, p_supplier_id, p_available_quantity, p_unit, p_unit_price,
    p_currency, nullif(trim(p_quality_notes), ''), 'not_checked', 'pending',
    p_expected_delivery_date, nullif(trim(p_notes), '')
  ) returning id into v_quote_id;

  update public.sourcing_requests
  set status = 'quoted', updated_at = now()
  where id = p_sourcing_request_id;
  return v_quote_id;
end;
$$;

create or replace function public.accept_sourcing_supplier_quote(p_quote_id uuid)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_quote public.sourcing_supplier_quotes%rowtype;
  v_request_status text;
  v_purchase_id uuid;
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
  if v_request_status in ('approved', 'fulfilled', 'cancelled') then
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
$$;

create or replace function public.update_sourcing_purchase_status(p_purchase_id uuid, p_status text)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_request_id uuid;
  v_current_status text;
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
  select sourcing_request_id, status into v_request_id, v_current_status
  from public.sourcing_purchases where id = p_purchase_id for update;
  if not found then raise exception 'Compra não encontrada.'; end if;
  if v_current_status in ('delivered', 'cancelled') and p_status <> v_current_status then
    raise exception 'Uma compra entregue ou cancelada é terminal e não pode ser reaberta.';
  end if;

  update public.sourcing_purchases
  set status = p_status,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else null end,
      updated_at = now()
  where id = p_purchase_id;

  if p_status = 'delivered' then
    update public.sourcing_requests set status = 'fulfilled', updated_at = now() where id = v_request_id;
  elsif p_status = 'cancelled' then
    update public.sourcing_requests set status = 'quoted', updated_at = now()
    where id = v_request_id and status = 'approved';
  end if;
end;
$$;

revoke all on function public.create_sourcing_supplier_quote(uuid, uuid, numeric, text, numeric, text, date, text, text) from public, anon;
revoke all on function public.accept_sourcing_supplier_quote(uuid) from public, anon;
revoke all on function public.update_sourcing_purchase_status(uuid, text) from public, anon;
grant execute on function public.create_sourcing_supplier_quote(uuid, uuid, numeric, text, numeric, text, date, text, text) to authenticated;
grant execute on function public.accept_sourcing_supplier_quote(uuid) to authenticated;
grant execute on function public.update_sourcing_purchase_status(uuid, text) to authenticated;

commit;
