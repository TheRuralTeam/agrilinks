-- Adicionar campo is_super_root para distinguir super roots de roots normais
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_super_root boolean DEFAULT false;

-- Tornar Claúdio A. Henriques um super root
UPDATE public.users 
SET is_super_root = true 
WHERE id = '25a7fafb-ab0f-4ec4-a126-f6a837c8c123';

-- Criar função para verificar se é super root
CREATE OR REPLACE FUNCTION public.is_super_root(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _user_id AND is_super_root = true AND is_root_admin = true
  ) AND public.has_role(_user_id, 'admin');
$$;