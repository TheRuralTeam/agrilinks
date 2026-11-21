-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261007200933; original ledger name: trusted_login_security_pin_policy.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.


create table if not exists security.user_security_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_security_pins_failed_attempts_ck check (failed_attempts >= 0)
);

alter table security.user_security_pins enable row level security;
revoke all on security.user_security_pins from anon, authenticated;
grant all on security.user_security_pins to service_role;

drop function if exists public.firewall_security_policy(text, text, text);
create or replace function public.firewall_security_policy(
  p_user_id text,
  p_ip_hash text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = security, public
as $$
declare
  v_user uuid;
  v_trusted boolean;
begin
  v_user := p_user_id::uuid;
  select exists(
    select 1 from security.trusted_login_ips
    where user_id = v_user and ip_hash = p_ip_hash
  ) into v_trusted;

  return jsonb_build_object(
    'allow_password_only', v_trusted,
    'require_second_factor', not v_trusted,
    'allowed_methods', case
      when v_trusted then jsonb_build_array('password')
      else jsonb_build_array('email_otp','security_pin')
    end,
    'action', p_action
  );
end;
$$;

revoke all on function public.firewall_security_policy(text,text,text) from public, anon, authenticated;
grant execute on function public.firewall_security_policy(text,text,text) to service_role;
