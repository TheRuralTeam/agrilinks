-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008183545; original ledger name: 20261008170500_corrigir_idempotencia_transferencias.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

begin;
drop index if exists public.ux_transactions_operation_id;
create unique index if not exists ux_transactions_operation_wallet
  on public.transactions(operation_id, wallet_id)
  where operation_id is not null;
commit;
