-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251113233038; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Remover a função que cria wallet com CASCADE para remover triggers dependentes
DROP FUNCTION IF EXISTS public.create_wallet_for_new_user() CASCADE;

-- Remover triggers de notificação de transações (relacionados a wallets)
DROP TRIGGER IF EXISTS notify_transaction_created_trigger ON public.transactions;
DROP TRIGGER IF EXISTS notify_transaction_completed_trigger ON public.transactions;

-- Remover funções de notificação de transações
DROP FUNCTION IF EXISTS public.notify_transaction_created() CASCADE;
DROP FUNCTION IF EXISTS public.notify_transaction_completed() CASCADE;
