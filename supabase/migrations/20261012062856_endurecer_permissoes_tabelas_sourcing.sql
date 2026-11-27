-- Garantir privilégios mínimos mesmo que existam permissões padrão no esquema public.
revoke all on table public.sourcing_supplier_leads from anon, authenticated;
revoke all on table public.sourcing_supplier_quotes from anon, authenticated;
revoke all on table public.sourcing_quote_events from anon, authenticated;

grant select, insert, update on table public.sourcing_supplier_leads to authenticated;
grant select, insert, update on table public.sourcing_supplier_quotes to authenticated;
grant select on table public.sourcing_quote_events to authenticated;
