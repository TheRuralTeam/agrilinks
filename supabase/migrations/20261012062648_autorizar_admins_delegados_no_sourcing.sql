-- Permitir que administradores delegados com manage_sourcing operem no módulo, sem ampliar permissões a outras áreas.
drop policy if exists "Sourcing admins manage supplier leads" on public.sourcing_supplier_leads;
create policy "Sourcing admins manage supplier leads"
on public.sourcing_supplier_leads for all to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
)
with check (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);

drop policy if exists "Sourcing admins manage supplier quotes" on public.sourcing_supplier_quotes;
create policy "Sourcing admins manage supplier quotes"
on public.sourcing_supplier_quotes for all to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
)
with check (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);

drop policy if exists "Sourcing admins read quote history" on public.sourcing_quote_events;
create policy "Sourcing admins read quote history"
on public.sourcing_quote_events for select to authenticated
using (
  public.is_agrilink_admin()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission)
);
