-- Permitir que contas delegadas com manage_sourcing consultem e actualizem pedidos de sourcing.
drop policy if exists "Sourcing managers can read requests" on public.sourcing_requests;
create policy "Sourcing managers can read requests"
on public.sourcing_requests for select to authenticated
using (public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission));

drop policy if exists "Sourcing managers can update requests" on public.sourcing_requests;
create policy "Sourcing managers can update requests"
on public.sourcing_requests for update to authenticated
using (public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission))
with check (public.has_admin_permission(auth.uid(), 'manage_sourcing'::public.admin_permission));
