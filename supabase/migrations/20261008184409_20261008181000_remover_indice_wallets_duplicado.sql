-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008184409; original ledger name: 20261008181000_remover_indice_wallets_duplicado.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

DROP INDEX IF EXISTS public.wallets_user_id_unique_idx;
