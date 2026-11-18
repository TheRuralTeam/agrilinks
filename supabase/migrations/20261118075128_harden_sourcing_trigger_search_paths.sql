-- These SECURITY DEFINER trigger functions already schema-qualify their table
-- and function references. Pinning search_path to empty prevents object-shadowing
-- without changing trigger behavior or grants.

begin;

alter function public.audit_sourcing_activity() set search_path = '';
alter function public.audit_sourcing_supplier_quote() set search_path = '';
alter function public.enqueue_sourcing_agent_intake() set search_path = '';
alter function public.notify_admins_new_sourcing_request() set search_path = '';
alter function public.sync_agent_tasks_with_sourcing_status() set search_path = '';

commit;
