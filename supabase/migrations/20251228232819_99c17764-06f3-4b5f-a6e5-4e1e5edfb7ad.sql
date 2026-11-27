
-- Create admin permissions enum
CREATE TYPE public.admin_permission AS ENUM (
  'manage_users',      -- Verificar/gerenciar usuários
  'manage_products',   -- Gerenciar produtos
  'manage_orders',     -- Gerenciar pedidos
  'manage_support',    -- Gerenciar mensagens de suporte
  'manage_sourcing',   -- Gerenciar pedidos de sourcing
  'view_analytics',    -- Ver analytics e dados de mercado
  'manage_admins'      -- Gerenciar outros admins (apenas root)
);

-- Create admin_permissions table
CREATE TABLE public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission admin_permission NOT NULL,
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Add is_root_admin column to identify root admins
ALTER TABLE public.users ADD COLUMN is_root_admin BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is root admin
CREATE OR REPLACE FUNCTION public.is_root_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _user_id AND is_root_admin = true
  ) AND public.has_role(_user_id, 'admin');
$$;

-- Create function to check specific admin permission
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _permission admin_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_root_admin(_user_id) OR
    EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = _user_id AND permission = _permission
    );
$$;

-- RLS Policies for admin_permissions
CREATE POLICY "Root admins can manage all permissions"
ON public.admin_permissions
FOR ALL
USING (public.is_root_admin(auth.uid()))
WITH CHECK (public.is_root_admin(auth.uid()));

CREATE POLICY "Admins can view their own permissions"
ON public.admin_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Set root admin status for the main admins
UPDATE public.users
SET is_root_admin = true
WHERE email IN ('contactsagrilink@gmail.com', 'ruraltechia@gmail.com');

-- Grant all permissions to root admins
INSERT INTO public.admin_permissions (user_id, permission)
SELECT u.id, p.permission
FROM public.users u
CROSS JOIN (
  SELECT unnest(enum_range(NULL::admin_permission)) AS permission
) p
WHERE u.is_root_admin = true
ON CONFLICT (user_id, permission) DO NOTHING;
