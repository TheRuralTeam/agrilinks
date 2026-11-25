-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261007110149; original ledger name: firewall_service_role_rpc_wrappers.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

create or replace function public.firewall_is_blocked(p_identifier text, p_identifier_type text)
returns boolean language sql security definer set search_path = security, pg_temp
as $$ select security.is_blocked(p_identifier, p_identifier_type) $$;

create or replace function public.firewall_consume(p_bucket_key text, p_window_seconds integer, p_max_requests integer)
returns boolean language sql security definer set search_path = security, pg_temp
as $$ select security.consume(p_bucket_key, p_window_seconds, p_max_requests) $$;

create or replace function public.firewall_record_event(
  p_identifier text,p_identifier_type text,p_user_id uuid,p_action text,p_route text,
  p_method text,p_status_code integer,p_risk_score integer,p_reason text,p_user_agent text,p_metadata jsonb
) returns void language sql security definer set search_path = security, pg_temp
as $$ select security.record_event(p_identifier,p_identifier_type,p_user_id,p_action,p_route,p_method,p_status_code,p_risk_score,p_reason,p_user_agent,p_metadata) $$;

revoke all on function public.firewall_is_blocked(text,text) from public, anon, authenticated;
revoke all on function public.firewall_consume(text,integer,integer) from public, anon, authenticated;
revoke all on function public.firewall_record_event(text,text,uuid,text,text,text,integer,integer,text,text,jsonb) from public, anon, authenticated;

grant execute on function public.firewall_is_blocked(text,text) to service_role;
grant execute on function public.firewall_consume(text,integer,integer) to service_role;
grant execute on function public.firewall_record_event(text,text,uuid,text,text,text,integer,integer,text,text,jsonb) to service_role;
