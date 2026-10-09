-- QA/security: tornar explícito o search_path da validação pública de código
-- de agente e normalizar o cabeçalho IP sem alterar o contrato booleano da RPC.

create or replace function public.validate_agent_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_headers jsonb;
  v_ip text;
  v_bucket text;
  v_now timestamptz := now();
  v_count integer;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{6}$' then
    return false;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;

  v_ip := coalesce(
    nullif(btrim(v_headers->>'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), ''),
    nullif(btrim(v_headers->>'x-real-ip'), '')
  );

  v_bucket := 'agent-code:ip:' || md5(coalesce(nullif(btrim(v_ip), ''), 'unknown'));

  insert into public.api_rate_limits(bucket_key, window_started, request_count, updated_at)
  values (v_bucket, v_now, 1, v_now)
  on conflict (bucket_key) do update set
    request_count = case
      when public.api_rate_limits.window_started <= v_now - interval '15 minutes' then 1
      else public.api_rate_limits.request_count + 1
    end,
    window_started = case
      when public.api_rate_limits.window_started <= v_now - interval '15 minutes' then v_now
      else public.api_rate_limits.window_started
    end,
    updated_at = v_now
  returning request_count into v_count;

  if v_count > 30 then
    return false;
  end if;

  return exists (
    select 1
    from public.users
    where user_type = 'agente'
      and agent_code = upper(p_code)
  );
end;
$function$;

revoke all on function public.validate_agent_code(text) from public;
grant execute on function public.validate_agent_code(text) to anon, authenticated;
