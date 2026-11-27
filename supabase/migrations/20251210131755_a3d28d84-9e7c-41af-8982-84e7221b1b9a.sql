-- Inserir role de admin para suporteagrilink@gmail.com
INSERT INTO public.user_roles (user_id, role) 
VALUES ('eb918895-0477-4bba-b0b7-b12f23e15f9a', 'admin') 
ON CONFLICT (user_id, role) DO NOTHING;