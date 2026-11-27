-- Enable RLS on fichas_recebimento table
ALTER TABLE public.fichas_recebimento ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own fichas
CREATE POLICY "Usuários podem ver suas próprias fichas"
ON public.fichas_recebimento
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to create their own fichas
CREATE POLICY "Usuários podem criar suas próprias fichas"
ON public.fichas_recebimento
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own fichas
CREATE POLICY "Usuários podem atualizar suas próprias fichas"
ON public.fichas_recebimento
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own fichas
CREATE POLICY "Usuários podem deletar suas próprias fichas"
ON public.fichas_recebimento
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to see all fichas
CREATE POLICY "Admins podem ver todas as fichas"
ON public.fichas_recebimento
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));