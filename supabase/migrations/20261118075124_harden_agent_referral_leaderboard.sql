-- The referral leaderboard exposes aggregate public-facing metrics to authenticated
-- users. Keep that intended behavior, but bound caller-controlled work and pin the
-- SECURITY DEFINER search_path to prevent object-shadowing attacks.

begin;

create or replace function public.get_top_agents_by_referrals(limit_count integer default 3)
returns table(
  agent_id uuid,
  agent_name text,
  agent_avatar text,
  total_referrals bigint,
  total_points bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  select
    u.id as agent_id,
    u.full_name as agent_name,
    u.avatar_url as agent_avatar,
    count(ar.id)::bigint as total_referrals,
    coalesce(sum(ar.points), 0)::bigint as total_points
  from public.users as u
  inner join public.agent_referrals as ar on ar.agent_id = u.id
  where u.user_type = 'agente'
  group by u.id, u.full_name, u.avatar_url
  order by total_referrals desc, total_points desc
  limit greatest(1, least(coalesce(limit_count, 3), 20));
end;
$function$;

commit;
