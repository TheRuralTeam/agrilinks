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
drop policy if exists "Buyers read purchases for own sourcing requests" on public.sourcing_purchases;
create policy "Buyers read purchases for own sourcing requests" on public.sourcing_purchases for select to authenticated
using (exists (select 1 from public.sourcing_requests r where r.id = sourcing_purchases.sourcing_request_id and r.user_id = auth.uid()));
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
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
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

create or replace function public.update_sourcing_purchase_status(p_purchase_id uuid, p_status text, p_notes text default null)
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

  if v_current_status = p_status then
    return;
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
revoke all on function public.update_sourcing_purchase_status(uuid, text, text) from public, anon;
grant execute on function public.create_sourcing_supplier_quote(uuid, uuid, numeric, text, numeric, text, date, text, text) to authenticated;
grant execute on function public.accept_sourcing_supplier_quote(uuid) to authenticated;
grant execute on function public.update_sourcing_purchase_status(uuid, text, text) to authenticated;


-- Align request mutations with the same delegated sourcing permission used by the
-- purchase RPCs. This also covers the AgriLink root-admin claim.
drop policy if exists "Sourcing managers update sourcing requests" on public.sourcing_requests;
create policy "Sourcing managers update sourcing requests"
on public.sourcing_requests for update to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
)
with check (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);

-- A single append-only activity stream records request, supplier and purchase changes.
create table if not exists public.sourcing_activity_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('request', 'supplier', 'purchase')),
  entity_id uuid not null,
  sourcing_request_id uuid references public.sourcing_requests(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  old_values jsonb,
  new_values jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sourcing_activity_request_created
  on public.sourcing_activity_events(sourcing_request_id, created_at desc);
create index if not exists idx_sourcing_activity_entity_created
  on public.sourcing_activity_events(entity_type, entity_id, created_at desc);
alter table public.sourcing_activity_events enable row level security;
drop policy if exists "Sourcing managers read activity" on public.sourcing_activity_events;
create policy "Sourcing managers read activity"
on public.sourcing_activity_events for select to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  or (sourcing_request_id is not null and exists (
    select 1 from public.sourcing_requests r
    where r.id = sourcing_activity_events.sourcing_request_id and r.user_id = auth.uid()
  ))
);
revoke all on public.sourcing_activity_events from anon, authenticated;
grant select on public.sourcing_activity_events to authenticated;

create or replace function public.audit_sourcing_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_entity_id uuid;
  v_request_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_entity_id := (v_old ->> 'id')::uuid;
    if tg_table_name = 'sourcing_requests' then
      v_request_id := v_entity_id;
    elsif tg_table_name = 'sourcing_purchases' then
      v_request_id := (v_old ->> 'sourcing_request_id')::uuid;
    end if;
    insert into public.sourcing_activity_events(entity_type, entity_id, sourcing_request_id, actor_id, event_type, old_values, new_values)
    values (
      case tg_table_name when 'sourcing_requests' then 'request' when 'sourcing_supplier_leads' then 'supplier' else 'purchase' end,
      v_entity_id, v_request_id, auth.uid(), 'deleted', v_old, jsonb_build_object('deleted', true)
    );
    return old;
  end if;

  v_new := to_jsonb(new);
  v_entity_id := (v_new ->> 'id')::uuid;
  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  if tg_table_name = 'sourcing_requests' then
    v_request_id := v_entity_id;
  elsif tg_table_name = 'sourcing_purchases' then
    v_request_id := (v_new ->> 'sourcing_request_id')::uuid;
  end if;

  insert into public.sourcing_activity_events(entity_type, entity_id, sourcing_request_id, actor_id, event_type, old_values, new_values)
  values (
    case tg_table_name when 'sourcing_requests' then 'request' when 'sourcing_supplier_leads' then 'supplier' else 'purchase' end,
    v_entity_id, v_request_id, auth.uid(),
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    v_old, v_new
  );
  return new;
end;
$body$;
revoke all on function public.audit_sourcing_activity() from public, anon, authenticated;

drop trigger if exists sourcing_requests_activity_audit on public.sourcing_requests;
create trigger sourcing_requests_activity_audit
after insert or update or delete on public.sourcing_requests
for each row execute function public.audit_sourcing_activity();
drop trigger if exists sourcing_supplier_leads_activity_audit on public.sourcing_supplier_leads;
create trigger sourcing_supplier_leads_activity_audit
after insert or update or delete on public.sourcing_supplier_leads
for each row execute function public.audit_sourcing_activity();
drop trigger if exists sourcing_purchases_activity_audit on public.sourcing_purchases;
create trigger sourcing_purchases_activity_audit
after insert or update or delete on public.sourcing_purchases
for each row execute function public.audit_sourcing_activity();

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
security invoker
set search_path = ''
as $body$
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
  if p_source is null or p_source not in ('manual', 'referral', 'marketplace', 'other') then
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
$body$;

create or replace function public.set_sourcing_supplier_verification(
  p_supplier_id uuid,
  p_status text,
  p_verification_notes text
) returns void
language plpgsql
security invoker
set search_path = ''
as $body$
begin
  if not (
    public.is_agrilink_admin()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
  ) then
    raise exception 'Sem permissão para verificar fornecedores.';
  end if;
  if p_status is null or p_status not in ('confirmed', 'rejected', 'unverified') then
    raise exception 'Estado de verificação inválido.';
  end if;
  if p_status in ('confirmed', 'rejected') and nullif(btrim(p_verification_notes), '') is null then
    raise exception 'Registe a evidência e o método de verificação antes de confirmar ou rejeitar.';
  end if;
  update public.sourcing_supplier_leads
  set verification_status = p_status,
      verification_notes = nullif(btrim(p_verification_notes), ''),
      verified_at = case when p_status = 'unverified' then null else now() end,
      verified_by = case when p_status = 'unverified' then null else auth.uid() end,
      updated_at = now()
  where id = p_supplier_id;
  if not found then raise exception 'Fornecedor não encontrado.'; end if;
end;
$body$;

create or replace function public.update_sourcing_request_status(
  p_request_id uuid,
  p_status text
) returns void
language plpgsql
security invoker
set search_path = ''
as $body$
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
  if v_current_status in ('approved', 'fulfilled', 'cancelled') then
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
$body$;

create or replace function public.update_sourcing_purchase_status(p_purchase_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $body$
declare
  v_request_id uuid;
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
  select sourcing_request_id, status into v_request_id, v_current_status
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
    update public.sourcing_requests set status = 'quoted', updated_at = now()
    where id = v_request_id and status = 'approved';
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Compra cancelada, mas o pedido não estava aprovado. Operação revertida.'; end if;
  end if;
end;
$body$;

revoke all on function public.create_sourcing_supplier_lead(text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.set_sourcing_supplier_verification(uuid, text, text) from public, anon;
revoke all on function public.update_sourcing_request_status(uuid, text) from public, anon;
grant execute on function public.create_sourcing_supplier_lead(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_sourcing_supplier_verification(uuid, text, text) to authenticated;
grant execute on function public.update_sourcing_request_status(uuid, text) to authenticated;

commit;
