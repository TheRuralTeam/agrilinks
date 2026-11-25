-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261007195919; original ledger name: trusted_login_devices_and_ip_controls.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

create table if not exists security.trusted_login_ips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, ip_hash)
);

create index if not exists trusted_login_ips_user_idx
  on security.trusted_login_ips(user_id, last_seen_at desc);

create table if not exists security.login_device_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null,
  ip_display text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists login_device_challenges_user_idx
  on security.login_device_challenges(user_id, created_at desc);

create unique index if not exists login_device_challenges_active_idx
  on security.login_device_challenges(user_id, ip_hash)
  where consumed_at is null;

create table if not exists security.registration_ip_claims (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null unique,
  registered_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table security.trusted_login_ips enable row level security;
alter table security.login_device_challenges enable row level security;
alter table security.registration_ip_claims enable row level security;

revoke all on security.trusted_login_ips, security.login_device_challenges, security.registration_ip_claims
from public, anon, authenticated;

grant select, insert, update, delete on security.trusted_login_ips to service_role;
grant select, insert, update, delete on security.login_device_challenges to service_role;
grant select, insert, update, delete on security.registration_ip_claims to service_role;
