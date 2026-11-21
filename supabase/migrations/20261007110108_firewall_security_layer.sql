-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261007110108; original ledger name: firewall_security_layer.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

create schema if not exists security;

create table if not exists security.firewall_blocks (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  identifier_type text not null check (identifier_type in ('ip','user','fingerprint','email')),
  reason text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists firewall_blocks_identifier_idx on security.firewall_blocks(identifier, identifier_type);
create index if not exists firewall_blocks_expires_idx on security.firewall_blocks(expires_at);

create table if not exists security.firewall_events (
  id bigint generated always as identity primary key,
  identifier text,
  identifier_type text,
  user_id uuid references auth.users(id),
  action text not null,
  route text,
  method text,
  status_code integer,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  reason text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists firewall_events_created_idx on security.firewall_events(created_at desc);
create index if not exists firewall_events_identifier_idx on security.firewall_events(identifier, created_at desc);
create index if not exists firewall_events_risk_idx on security.firewall_events(risk_score desc, created_at desc);

alter table security.firewall_blocks enable row level security;
alter table security.firewall_events enable row level security;

revoke all on schema security from public, anon, authenticated;
revoke all on all tables in schema security from public, anon, authenticated;

create or replace function security.consume(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_requests integer
) returns boolean
language plpgsql
security definer
set search_path = public, security, pg_temp
as $$
declare
  v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) = 0 or length(p_bucket_key) > 512
     or p_window_seconds not between 1 and 86400
     or p_max_requests not between 1 and 10000 then
    return false;
  end if;

  insert into public.api_rate_limits(bucket_key)
  values (p_bucket_key)
  on conflict (bucket_key) do nothing;

  select request_count into v_count
  from public.api_rate_limits
  where bucket_key = p_bucket_key
  for update;

  if v_count is null then
    return false;
  end if;

  if exists (
    select 1 from public.api_rate_limits
    where bucket_key = p_bucket_key
      and window_started <= now() - make_interval(secs => p_window_seconds)
  ) then
    update public.api_rate_limits
    set window_started = now(), request_count = 1, updated_at = now()
    where bucket_key = p_bucket_key;
    return true;
  end if;

  if v_count >= p_max_requests then
    return false;
  end if;

  update public.api_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where bucket_key = p_bucket_key;

  return true;
end;
$$;

revoke all on function security.consume(text, integer, integer) from public, anon, authenticated;

create or replace function security.is_blocked(
  p_identifier text,
  p_identifier_type text
) returns boolean
language sql
security definer
set search_path = security, pg_temp
as $$
  select exists (
    select 1
    from security.firewall_blocks
    where identifier = p_identifier
      and identifier_type = p_identifier_type
      and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function security.is_blocked(text, text) from public, anon, authenticated;

create or replace function security.record_event(
  p_identifier text,
  p_identifier_type text,
  p_user_id uuid,
  p_action text,
  p_route text,
  p_method text,
  p_status_code integer,
  p_risk_score integer,
  p_reason text,
  p_user_agent text,
  p_metadata jsonb
) returns void
language plpgsql
security definer
set search_path = security, pg_temp
as $$
begin
  insert into security.firewall_events(
    identifier, identifier_type, user_id, action, route, method,
    status_code, risk_score, reason, user_agent, metadata
  ) values (
    left(p_identifier, 512), p_identifier_type, p_user_id,
    left(p_action, 100), left(p_route, 500), left(p_method, 20),
    p_status_code, greatest(0, least(coalesce(p_risk_score, 0), 100)),
    left(p_reason, 500), left(p_user_agent, 1000),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function security.record_event(text,text,uuid,text,text,text,integer,integer,text,text,jsonb)
from public, anon, authenticated;

grant usage on schema security to service_role;
grant select, insert, update, delete on security.firewall_blocks to service_role;
grant select, insert on security.firewall_events to service_role;
grant execute on function security.consume(text,integer,integer) to service_role;
grant execute on function security.is_blocked(text,text) to service_role;
grant execute on function security.record_event(text,text,uuid,text,text,text,integer,integer,text,text,jsonb) to service_role;
