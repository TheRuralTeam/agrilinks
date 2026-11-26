-- Keep support-agent-only product visibility scoped to signed-in users.
-- Public visitors still read active products through the dedicated public policy.
ALTER POLICY "Assistentes podem ver todos os produtos"
ON public.products
TO authenticated;
