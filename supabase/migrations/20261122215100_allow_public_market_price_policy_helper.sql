-- Published market prices are public; allow the RLS policy helper to run for
-- anonymous reads. has_role() only returns true for the authenticated user's
-- own role (or service_role), so this does not expose other users' roles.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
