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

create or replace function public.get_freight_load_qr_details_by_id(p_freight_load_id uuid)
returns table (
  id uuid,
  display_id text,
  product_name text,
  weight_kg numeric,
  origin_label text,
  destination_label text,
  pickup_date date,
  offered_price numeric,
  currency text,
  status text,
  notes text,
  route_distance_km numeric,
  route_duration_minutes integer,
  pre_order_id uuid,
  order_display_id text,
  order_status text,
  payment_status text,
  buyer_name text,
  buyer_phone text,
  driver_name text,
  driver_phone text
)
language plpgsql
security definer
set search_path = ''
as $qr$
declare
  v_qr_token text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select fl.qr_token
  into v_qr_token
  from public.freight_loads fl
  where fl.id = p_freight_load_id;

  if not found or v_qr_token is null then
    raise exception 'FREIGHT_LOAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- The existing token RPC enforces participant/admin authorization.
  -- The token is consumed inside the database and is never returned to the client.
  return query
  select
    details.id,
    details.display_id,
    details.product_name,
    details.weight_kg,
    details.origin_label,
    details.destination_label,
    details.pickup_date,
    details.offered_price,
    details.currency,
    details.status,
    details.notes,
    details.route_distance_km,
    details.route_duration_minutes,
    details.pre_order_id,
    details.order_display_id,
    details.order_status,
    details.payment_status,
    details.buyer_name,
    details.buyer_phone,
    details.driver_name,
    details.driver_phone
  from public.get_freight_load_qr_details(v_qr_token) details;
end;
$qr$;

revoke all on function public.get_freight_load_qr_details_by_id(uuid) from public, anon;
grant execute on function public.get_freight_load_qr_details_by_id(uuid) to authenticated;

comment on function public.get_freight_load_qr_details_by_id(uuid) is
  'Returns participant-authorized freight QR details by load ID without disclosing the QR capability token.';

commit;
