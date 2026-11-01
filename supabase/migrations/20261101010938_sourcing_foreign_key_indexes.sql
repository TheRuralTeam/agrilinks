-- Cover foreign keys used by sourcing ownership, audit history and supplier lookups.
create index if not exists idx_sourcing_requests_user_id on public.sourcing_requests(user_id);
create index if not exists idx_sourcing_supplier_leads_created_by on public.sourcing_supplier_leads(created_by);
create index if not exists idx_sourcing_supplier_leads_verified_by on public.sourcing_supplier_leads(verified_by);
create index if not exists idx_sourcing_supplier_quotes_created_by on public.sourcing_supplier_quotes(created_by);
create index if not exists idx_sourcing_supplier_quotes_confirmed_by on public.sourcing_supplier_quotes(confirmed_by);
create index if not exists idx_sourcing_quote_events_quote_id on public.sourcing_quote_events(quote_id);
create index if not exists idx_sourcing_quote_events_actor_id on public.sourcing_quote_events(actor_id);
create index if not exists idx_sourcing_activity_events_actor_id on public.sourcing_activity_events(actor_id);
create index if not exists idx_sourcing_purchases_supplier_id on public.sourcing_purchases(supplier_id);
create index if not exists idx_sourcing_purchases_ordered_by on public.sourcing_purchases(ordered_by);