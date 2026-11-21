-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20260410010504; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.


-- Users should be able to see their own products regardless of status
CREATE POLICY "Usuários podem ver seus próprios produtos"
ON public.products
FOR SELECT
USING (auth.uid() = user_id);
