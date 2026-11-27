-- Ensure root admins have the admin role in user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM public.users u
WHERE u.is_root_admin = true
ON CONFLICT (user_id, role) DO NOTHING;