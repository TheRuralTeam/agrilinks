-- Ponto 02 do AgriLink Sourcing: fornecedores, cotações confirmadas e histórico.
create table if not exists public.sourcing_supplier_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(trim(company_name)) between 2 and 160),
  contact_name text,
  phone text not null check (char_length(trim(phone)) between 6 and 40),
  product_name text not null check (char_length(trim(product_name)) between 2 and 120),
  province_id text,
  municipality_id text,
  locality text check (locality is null or char_length(locality) <= 180),
  source text not null default 'manual' check (source in ('manual', 'marketplace', 'referral', 'field_visit', 'other')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'contacted', 'confirmed', 'unavailable', 'rejected')),
  verification_notes text check (verification_notes is null or char_length(verification_notes) <= 2000),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((verification_status <> 'confirmed') or (verified_at is not null and verified_by is not null))
);
create index if not exists idx_sourcing_supplier_leads_product_location on public.sourcing_supplier_leads (lower(product_name), province_id, municipality_id);
create index if not exists idx_sourcing_supplier_leads_phone on public.sourcing_supplier_leads (phone);

create table if not exists public.sourcing_supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  sourcing_request_id uuid not null references public.sourcing_requests(id) on delete restrict,
  supplier_id uuid not null references public.sourcing_supplier_leads(id) on delete restrict,
  available_quantity numeric(14,3) not null check (available_quantity > 0),
  unit text not null check (unit in ('kg', 'tonelada', 'saco', 'caixa', 'unidade')),
  unit_price numeric(14,2) check (unit_price is null or unit_price >= 0),
  currency text not null default 'AOA' check (currency in ('AOA', 'USD', 'EUR')),
  quality_notes text check (quality_notes is null or char_length(quality_notes) <= 2000),
  availability_status text not null default 'not_checked' check (availability_status in ('not_checked', 'available', 'partially_available', 'unavailable')),
  confirmation_status text not null default 'pending' check (confirmation_status in ('pending', 'confirmed', 'rejected', 'expired')),
  expected_delivery_date date,
  valid_until date,
  confirmation_method text check (confirmation_method is null or confirmation_method in ('phone', 'in_person', 'marketplace', 'document', 'other')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= created_at::date),
  check (confirmation_status <> 'confirmed' or (availability_status in ('available', 'partially_available') and confirmed_by is not null and confirmed_at is not null))
);
create index if not exists idx_sourcing_quotes_request_status on public.sourcing_supplier_quotes (sourcing_request_id, confirmation_status, created_at desc);
create index if not exists idx_sourcing_quotes_supplier on public.sourcing_supplier_quotes (supplier_id, created_at desc);

create table if not exists public.sourcing_quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sourcing_supplier_quotes(id) on delete restrict,
  sourcing_request_id uuid not null references public.sourcing_requests(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created', 'updated')),
  old_values jsonb,
  new_values jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sourcing_quote_events_request on public.sourcing_quote_events (sourcing_request_id, created_at desc);

create or replace function public.set_sourcing_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists sourcing_supplier_leads_set_updated_at on public.sourcing_supplier_leads;
create trigger sourcing_supplier_leads_set_updated_at before update on public.sourcing_supplier_leads for each row execute function public.set_sourcing_updated_at();
drop trigger if exists sourcing_supplier_quotes_set_updated_at on public.sourcing_supplier_quotes;
create trigger sourcing_supplier_quotes_set_updated_at before update on public.sourcing_supplier_quotes for each row execute function public.set_sourcing_updated_at();

create or replace function public.audit_sourcing_supplier_quote()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.sourcing_quote_events (quote_id, sourcing_request_id, actor_id, event_type, old_values, new_values)
  values (new.id, new.sourcing_request_id, auth.uid(), case when tg_op = 'INSERT' then 'created' else 'updated' end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end, to_jsonb(new));
  return new;
end;
$$;
drop trigger if exists sourcing_supplier_quotes_audit on public.sourcing_supplier_quotes;
create trigger sourcing_supplier_quotes_audit after insert or update on public.sourcing_supplier_quotes for each row execute function public.audit_sourcing_supplier_quote();

alter table public.sourcing_supplier_leads enable row level security;
alter table public.sourcing_supplier_quotes enable row level security;
alter table public.sourcing_quote_events enable row level security;

drop policy if exists "Sourcing admins manage supplier leads" on public.sourcing_supplier_leads;
create policy "Sourcing admins manage supplier leads" on public.sourcing_supplier_leads for all to authenticated
using (public.is_agrilink_admin() or public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.is_agrilink_admin() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Sourcing admins manage supplier quotes" on public.sourcing_supplier_quotes;
create policy "Sourcing admins manage supplier quotes" on public.sourcing_supplier_quotes for all to authenticated
using (public.is_agrilink_admin() or public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.is_agrilink_admin() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Buyers read quotes for their own sourcing requests" on public.sourcing_supplier_quotes;
create policy "Buyers read quotes for their own sourcing requests" on public.sourcing_supplier_quotes for select to authenticated
using (exists (select 1 from public.sourcing_requests r where r.id = sourcing_supplier_quotes.sourcing_request_id and r.user_id = auth.uid()));

drop policy if exists "Sourcing admins read quote history" on public.sourcing_quote_events;
create policy "Sourcing admins read quote history" on public.sourcing_quote_events for select to authenticated
using (public.is_agrilink_admin() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Buyers read quote history for their own requests" on public.sourcing_quote_events;
create policy "Buyers read quote history for their own requests" on public.sourcing_quote_events for select to authenticated
using (exists (select 1 from public.sourcing_requests r where r.id = sourcing_quote_events.sourcing_request_id and r.user_id = auth.uid()));

revoke all on public.sourcing_supplier_leads, public.sourcing_supplier_quotes, public.sourcing_quote_events from anon;
grant select, insert, update on public.sourcing_supplier_leads to authenticated;
grant select, insert, update on public.sourcing_supplier_quotes to authenticated;
grant select on public.sourcing_quote_events to authenticated;
revoke all on function public.audit_sourcing_supplier_quote() from public, anon, authenticated;
revoke all on function public.set_sourcing_updated_at() from public, anon, authenticated;
