-- Disposable PostgreSQL fixture for centralized marketplace payment allocation tests.
do $roles$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role service_role nologin;
exception when duplicate_object then null;
end
$roles$;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $;

create or replace function auth.role()
returns text language sql stable
as $ select nullif(current_setting('request.jwt.claim.role', true), '') $;

do $types$
begin
  create type public.app_role as enum ('admin');
exception when duplicate_object then null;
end
$types$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable as $role$
  select auth.uid() = _user_id and current_setting('test.is_admin', true) = 'true'
$role$;

create or replace function public.is_root_admin(p_user_id uuid)
returns boolean language sql stable as $root$
  select false
$root$;

create table public.users (
  id uuid primary key
);

create table public.products (
  id uuid primary key,
  user_id uuid not null references public.users(id)
);

create table public.pre_orders (
  id uuid primary key,
  product_id uuid not null references public.products(id),
  user_id uuid not null references public.users(id),
  status text not null,
  payment_status text not null,
  total_price numeric(15,2) not null,
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key,
  pre_order_id uuid references public.pre_orders(id),
  created_at timestamptz default now()
);

create table public.freight_loads (
  id uuid primary key,
  created_by uuid not null references public.users(id),
  driver_id uuid references public.users(id),
  buyer_id uuid references public.users(id),
  supplier_id uuid references public.users(id),
  pre_order_id uuid references public.pre_orders(id),
  order_id uuid references public.orders(id),
  status text not null,
  driver_quote_status text not null,
  offered_price numeric(15,2),
  driver_offered_price numeric(15,2),
  currency text not null default 'Kz',
  supplier_handover_confirmed_at timestamptz,
  driver_pickup_confirmed_at timestamptz,
  driver_delivery_confirmed_at timestamptz,
  buyer_receipt_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.freight_delivery_evidence (
  id uuid primary key,
  freight_load_id uuid not null references public.freight_loads(id),
  driver_id uuid not null references public.users(id)
);

create table public.payment_providers (
  id text primary key,
  enabled boolean not null default false,
  test_mode boolean not null default true,
  platform_destination_verified boolean not null default false
);

insert into public.payment_providers (id, enabled, test_mode, platform_destination_verified)
values ('agrilink_test_provider', true, false, true);

create table public.payment_intents (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  provider_id text not null references public.payment_providers(id),
  pre_order_id uuid references public.pre_orders(id),
  amount numeric(15,2) not null,
  currency char(3) not null,
  purpose text not null,
  status text not null
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id),
  order_id uuid references public.orders(id),
  recipient_user_id uuid references public.users(id),
  allocation_type text not null check (allocation_type in ('seller','driver','agent','platform_fee','refund_reserve','other')),
  amount numeric(15,2) not null check (amount > 0),
  currency char(3) not null default 'AOA',
  status text not null default 'pending' check (status in ('pending','blocked','available','paid','cancelled','refunded')),
  wallet_transaction_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique(payment_intent_id,recipient_user_id,allocation_type)
);

create table public.freight_settlements (
  id uuid primary key default gen_random_uuid(),
  freight_load_id uuid not null unique references public.freight_loads(id),
  driver_id uuid not null references public.users(id),
  currency text not null,
  gross_amount numeric not null check (gross_amount > 0),
  agrilink_commission numeric not null check (agrilink_commission >= 0),
  driver_amount numeric not null check (driver_amount >= 0),
  status text not null default 'awaiting_manual_payout'
    check (status in ('awaiting_manual_payout','paid','cancelled')),
  confirmed_at timestamptz not null default now()
);

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id bigserial primary key,
  bucket_id text not null,
  name text not null
);

create table public.marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  payment_allocation_id uuid not null unique references public.payment_allocations(id) on delete restrict,
  recipient_user_id uuid not null references public.users(id) on delete restrict,
  payout_type text not null check (payout_type in ('seller','driver')),
  amount numeric(15,2) not null check (amount > 0),
  currency char(3) not null default 'AOA',
  status text not null default 'awaiting_beneficiary_verification'
    check (status in (
      'awaiting_beneficiary_verification','awaiting_manual_payout',
      'processing','paid','failed','blocked','cancelled'
    )),
  provider_reference text,
  payout_reference text,
  proof_url text,
  failure_reason text,
  paid_at timestamptz,
  paid_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_payouts_paid_reference_check
    check (status <> 'paid' or (paid_at is not null and payout_reference is not null))
);
