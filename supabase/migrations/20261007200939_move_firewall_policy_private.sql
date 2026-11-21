-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261007200939; original ledger name: move_firewall_policy_private.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.


drop function if exists public.firewall_security_policy(text,text,text);

create or replace function security.firewall_security_policy(
  p_user_id uuid,
  p_ip_hash text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = security, pg_temp
as $$
declare
  v_trusted boolean;
begin
  select exists(
    select 1
    from security.trusted_login_ips
    where user_id = p_user_id
      and ip_hash = p_ip_hash
  ) into v_trusted;

  return jsonb_build_object(
    'allow_password_only', v_trusted,
    'require_second_factor', not v_trusted,
    'allowed_methods',
      case when v_trusted
        then jsonb_build_array('password')
        else jsonb_build_array('email_otp','security_pin')
      end,
    'action', p_action
  );
end;
$$;

revoke all on function security.firewall_security_policy(uuid,text,text) from public, anon, authenticated;
grant execute on function security.firewall_security_policy(uuid,text,text) to service_role;
