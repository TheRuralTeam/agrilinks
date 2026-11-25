-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261007200042; original ledger name: trusted_devices_and_recovery_codes.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

create table if not exists security.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token_hash text not null unique,
  ip_hash text not null,
  user_agent_hash text,
  label text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists trusted_devices_user_idx on security.trusted_devices(user_id, last_seen_at desc);
create index if not exists trusted_devices_ip_idx on security.trusted_devices(user_id, ip_hash);

create table if not exists security.account_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz
);

create index if not exists account_recovery_codes_user_idx
  on security.account_recovery_codes(user_id, used_at, expires_at);

alter table security.trusted_devices enable row level security;
alter table security.account_recovery_codes enable row level security;

revoke all on security.trusted_devices, security.account_recovery_codes from public, anon, authenticated;
grant select, insert, update, delete on security.trusted_devices to service_role;
grant select, insert, update, delete on security.account_recovery_codes to service_role;

create or replace function security.consume_recovery_code(
  p_user_id uuid,
  p_code_hash text
) returns boolean
language plpgsql
security definer
set search_path = security, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from security.account_recovery_codes
  where user_id = p_user_id
    and code_hash = p_code_hash
    and used_at is null
    and (expires_at is null or expires_at > now())
  order by created_at
  limit 1
  for update;

  if v_id is null then
    return false;
  end if;

  update security.account_recovery_codes
  set used_at = now()
  where id = v_id;

  return true;
end;
$$;

revoke all on function security.consume_recovery_code(uuid,text) from public, anon, authenticated;
grant execute on function security.consume_recovery_code(uuid,text) to service_role;
