-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261007195932; original ledger name: registration_ip_guard.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

create or replace function security.consume_registration_ip(p_ip_hash text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = security, pg_temp
as $$
begin
  if exists (
    select 1 from security.registration_ip_claims
    where ip_hash = p_ip_hash and expires_at > now()
  ) then
    return false;
  end if;

  insert into security.registration_ip_claims(ip_hash, registered_user_id, expires_at)
  values (p_ip_hash, p_user_id, now() + interval '24 hours')
  on conflict (ip_hash) do update
    set registered_user_id = excluded.registered_user_id,
        created_at = now(),
        expires_at = excluded.expires_at;

  return true;
end;
$$;

revoke all on function security.consume_registration_ip(text, uuid) from public, anon, authenticated;
grant execute on function security.consume_registration_ip(text, uuid) to service_role;
