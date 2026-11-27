do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'agrilink_agent_worker_secret'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'agrilink_agent_worker_secret',
      'Segredo interno para autorizar o agendador da fila de agentes AgriLink'
    );
  end if;
end
$$;

create or replace function public.verify_agent_worker_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select p_secret is not null
    and length(p_secret) >= 32
    and exists (
      select 1
      from vault.decrypted_secrets s
      where s.name = 'agrilink_agent_worker_secret'
        and s.decrypted_secret = p_secret
    );
$function$;

revoke all on function public.verify_agent_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_agent_worker_secret(text) to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'agent-orchestrator-every-minute';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'agent-orchestrator-every-minute',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://oqcrfqtlfqwrxxmsjpaf.supabase.co/functions/v1/agent-orchestrator-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (
            select (regexp_match(command, '''apikey'', ''([^'']+)'''))[1]
            from cron.job
            where jobname = 'email-outbox-every-minute'
          ),
          'Authorization', 'Bearer ' || (
            select (regexp_match(command, '''apikey'', ''([^'']+)'''))[1]
            from cron.job
            where jobname = 'email-outbox-every-minute'
          ),
          'x-agent-worker-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'agrilink_agent_worker_secret'
          )
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
end
$$;
