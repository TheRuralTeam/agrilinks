-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20260412235841; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

ALTER TABLE public.products DROP CONSTRAINT products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'removed'::text, 'pending_approval'::text, 'rejected'::text]));
