-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008183558; original ledger name: 20261008171000_remover_indice_pagamento_duplicado.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

drop index if exists public.ux_payment_intents_provider_reference_nonnull;
