-- Promover suporteagrilink@gmail.com a Root Admin
UPDATE public.users 
SET is_root_admin = true 
WHERE email = 'suporteagrilink@gmail.com';

-- Adicionar role de admin se não existir
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM public.users
WHERE email = 'suporteagrilink@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;