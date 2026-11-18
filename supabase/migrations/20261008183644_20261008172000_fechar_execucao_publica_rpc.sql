-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008183644; original ledger name: 20261008172000_fechar_execucao_publica_rpc.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

revoke execute on function public.rate_agrilink_ad(uuid, smallint) from public, anon;
revoke execute on function public.create_green_point_order(uuid, uuid, numeric, date) from public, anon;
