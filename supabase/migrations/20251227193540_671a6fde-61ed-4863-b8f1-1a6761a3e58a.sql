-- Add verified column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- Add verified_at column to track when verification happened
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone DEFAULT NULL;

-- Add verified_by column to track which admin verified the user
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_by uuid DEFAULT NULL;

-- Create index for faster queries on verified users
CREATE INDEX IF NOT EXISTS idx_users_verified ON public.users(verified);

-- Update RLS policy to allow admins to update verification status
CREATE POLICY "Admins podem atualizar status de verificação"
ON public.users
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));