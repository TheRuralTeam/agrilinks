-- Restrict freight discovery to available loads and actual participants.
-- QR tokens remain available only through the authenticated, ownership-checking RPC.
begin;

drop policy if exists "Authenticated can view freight loads" on public.freight_loads;
drop policy if exists "Freight participants can read their loads" on public.freight_loads;
drop policy if exists "AgriLink admins can read dashboard freight_loads" on public.freight_loads;
drop policy if exists "Pre-order buyers can view linked freight loads" on public.freight_loads;

create policy "Freight participants can read their loads"
on public.freight_loads
for select
to authenticated
using (
  created_by = (select auth.uid())
  or status in ('available', 'open', 'agendado')
  or driver_id = (select auth.uid())
  or supplier_id = (select auth.uid())
  or buyer_id = (select auth.uid())
  or exists (
    select 1
    from public.pre_orders po
    where po.id = freight_loads.pre_order_id
      and po.user_id = (select auth.uid())
  )
  or public.is_agrilink_admin()
);

-- Anonymous clients have no freight discovery or write use case.
revoke all on table public.freight_loads from anon;

-- Keep authenticated row-level access, but remove table-wide SELECT so the
-- secret QR token cannot be read through PostgREST or a wildcard projection.
revoke select on table public.freight_loads from authenticated;

grant select (
  id,
  created_by,
  driver_id,
  contract_id,
  order_id,
  product_id,
  product_name,
  weight_kg,
  origin_label,
  origin_lat,
  origin_lng,
  destination_label,
  destination_lat,
  destination_lng,
  pickup_date,
  offered_price,
  currency,
  status,
  notes,
  accepted_at,
  in_transit_at,
  delivered_at,
  created_at,
  updated_at,
  pre_order_id,
  driver_offered_price,
  driver_price_method,
  driver_quote_status,
  route_distance_km,
  route_duration_minutes,
  supplier_id,
  buyer_id,
  supplier_handover_confirmed_at,
  driver_pickup_confirmed_at,
  driver_delivery_confirmed_at,
  buyer_receipt_confirmed_at,
  driver_arrived_at,
  vehicle_id,
  driver_commitment_confirmed_at
) on public.freight_loads to authenticated;

commit;
