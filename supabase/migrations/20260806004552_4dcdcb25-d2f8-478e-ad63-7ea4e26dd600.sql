-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20260806004552; original ledger name: 4dcdcb25-d2f8-478e-ad63-7ea4e26dd600.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

ALTER TYPE public.user_type_enum ADD VALUE IF NOT EXISTS 'motorista';
