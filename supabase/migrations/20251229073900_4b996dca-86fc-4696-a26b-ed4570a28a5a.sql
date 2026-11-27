-- Create function to get top agents by referrals
CREATE OR REPLACE FUNCTION public.get_top_agents_by_referrals(limit_count integer DEFAULT 3)
RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  agent_avatar text,
  total_referrals bigint,
  total_points bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as agent_id,
    u.full_name as agent_name,
    u.avatar_url as agent_avatar,
    COUNT(ar.id)::BIGINT as total_referrals,
    COALESCE(SUM(ar.points), 0)::BIGINT as total_points
  FROM public.users u
  INNER JOIN public.agent_referrals ar ON ar.agent_id = u.id
  WHERE u.user_type = 'agente'
  GROUP BY u.id, u.full_name, u.avatar_url
  ORDER BY total_referrals DESC, total_points DESC
  LIMIT limit_count;
END;
$$;