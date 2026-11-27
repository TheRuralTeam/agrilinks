-- Minimal PostgreSQL 17 schema used to validate the purchase delivery evidence migration.
-- This database is disposable and isolated from the production Supabase project.

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

create schema if not exists auth;
create schema if not exists storage;

do $type$
begin
  create type public.app_role as enum ('admin');
exception when duplicate_object then null;
end
$type$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function storage.foldername(p_name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(regexp_replace(p_name, '/[^/]*$', ''), '/')
$$;

create or replace function public.has_role(p_user_id uuid, p_role public.app_role)
returns boolean
language sql
stable
as $$
  select false
$$;

create table public.users (
  id uuid primary key,
  user_type text not null,
  email_verified boolean not null default false
);

create table public.pre_orders (
  id uuid primary key,
  status text not null,
  payment_status text not null,
  updated_at timestamptz not null default now()
);

create table public.freight_loads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  driver_id uuid,
  buyer_id uuid,
  supplier_id uuid,
  pre_order_id uuid references public.pre_orders(id),
  order_id uuid,
  status text not null,
  driver_quote_status text,
  driver_arrived_at timestamptz,
  supplier_handover_confirmed_at timestamptz,
  driver_pickup_confirmed_at timestamptz,
  driver_delivery_confirmed_at timestamptz,
  buyer_receipt_confirmed_at timestamptz,
  in_transit_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.freight_load_events (
  id bigserial primary key,
  freight_load_id uuid not null references public.freight_loads(id),
  actor_id uuid,
  event_type text not null,
  constraint freight_load_events_event_type_check
    check (event_type in ('accepted', 'supplier_handover', 'driver_pickup', 'driver_delivery', 'buyer_received'))
);

create table public.order_transaction_events (
  id bigserial primary key,
  pre_order_id uuid,
  order_id uuid,
  freight_load_id uuid,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

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

alter table storage.objects enable row level security;
