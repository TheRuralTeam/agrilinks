-- Supplier custody handover and idempotent offline GPS synchronization.
-- Additive migration: existing loads and location history remain readable.
begin;

alter table public.freight_load_events
  drop constraint if exists freight_load_events_event_type_check;
alter table public.freight_load_events
  add constraint freight_load_events_event_type_check
  check (event_type in ('accepted', 'supplier_handover', 'driver_pickup', 'driver_departure', 'driver_delivery', 'buyer_received'));

alter table public.freight_load_location_history
  add column if not exists client_event_id uuid,
  add column if not exists device_id uuid,
  add column if not exists device_sequence bigint,
  add column if not exists captured_at timestamptz,
  add column if not exists received_at timestamptz;
update public.freight_load_location_history
set captured_at = coalesce(captured_at, recorded_at), received_at = coalesce(received_at, recorded_at)
where captured_at is null or received_at is null;
alter table public.freight_load_location_history alter column received_at set default now(), alter column received_at set not null;

alter table public.freight_load_locations
  add column if not exists captured_at timestamptz,
  add column if not exists received_at timestamptz;
update public.freight_load_locations
set captured_at = coalesce(captured_at, recorded_at), received_at = coalesce(received_at, recorded_at)
where captured_at is null or received_at is null;
alter table public.freight_load_locations alter column captured_at set default now(), alter column captured_at set not null, alter column received_at set default now(), alter column received_at set not null;

create unique index if not exists freight_location_history_event_uidx
  on public.freight_load_location_history(freight_load_id, client_event_id)
  where client_event_id is not null;

create unique index if not exists freight_location_history_device_sequence_uidx
  on public.freight_load_location_history(freight_load_id, device_id, device_sequence)
  where device_id is not null and device_sequence is not null;

create index if not exists freight_location_history_captured_idx
  on public.freight_load_location_history(freight_load_id, captured_at desc)
  where captured_at is not null;

create table if not exists public.freight_handover_evidence (
  id uuid primary key default gen_random_uuid(),
  freight_load_id uuid not null unique references public.freight_loads(id) on delete restrict,
  supplier_id uuid not null references public.users(id) on delete restrict,
  driver_id uuid not null references public.users(id) on delete restrict,
  vehicle_id uuid references public.driver_vehicles(id) on delete restrict,
  recipient_name text not null check (char_length(btrim(recipient_name)) between 2 and 160),
  product_quantity_kg numeric(14,2) not null check (product_quantity_kg > 0),
  condition_notes text,
  photo_path text not null,
  supplier_signature_path text not null,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  supplier_submitted_at timestamptz not null default now(),
  driver_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint freight_handover_gps_pair_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint freight_handover_accuracy_check check (
    accuracy_m is null or accuracy_m between 0 and 100000
  ),
  constraint freight_handover_photo_path_check check (
    photo_path like freight_load_id::text || '/' || supplier_id::text || '/%'
  ),
  constraint freight_handover_signature_path_check check (
    supplier_signature_path like freight_load_id::text || '/' || supplier_id::text || '/%'
  )
);

create index if not exists freight_handover_supplier_idx
  on public.freight_handover_evidence(supplier_id, supplier_submitted_at desc);
create index if not exists freight_handover_driver_idx
  on public.freight_handover_evidence(driver_id, supplier_submitted_at desc);

alter table public.freight_handover_evidence enable row level security;
revoke all on public.freight_handover_evidence from anon, authenticated;
grant select on public.freight_handover_evidence to authenticated;

drop policy if exists "Freight participants can read handover evidence" on public.freight_handover_evidence;
create policy "Freight participants can read handover evidence"
on public.freight_handover_evidence
for select to authenticated
using (
  exists (
    select 1
    from public.freight_loads fl
    where fl.id = freight_handover_evidence.freight_load_id
      and (
        auth.uid() in (fl.created_by, fl.driver_id, fl.supplier_id, fl.buyer_id)
        or public.is_agrilink_admin()
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'freight-handover-evidence',
  'freight-handover-evidence',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

drop policy if exists "Suppliers upload assigned handover evidence" on storage.objects;
create policy "Suppliers upload assigned handover evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'freight-handover-evidence'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.freight_loads fl
    where fl.id::text = (storage.foldername(name))[1]
      and fl.supplier_id = auth.uid()
      and fl.status = 'at_pickup'
      and fl.driver_id is not null
  )
);

drop policy if exists "Freight participants read handover evidence files" on storage.objects;
create policy "Freight participants read handover evidence files"
on storage.objects for select to authenticated
using (
  bucket_id = 'freight-handover-evidence'
  and (
    exists (
      select 1 from public.freight_loads fl
      where fl.id::text = (storage.foldername(name))[1]
        and auth.uid() in (fl.created_by, fl.driver_id, fl.supplier_id, fl.buyer_id)
    )
    or public.is_agrilink_admin()
  )
);

create or replace function public.submit_supplier_handover_evidence(
  p_freight_load_id uuid,
  p_recipient_name text,
  p_product_quantity_kg numeric,
  p_condition_notes text,
  p_photo_path text,
  p_supplier_signature_path text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_load public.freight_loads%rowtype;
  v_evidence_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_recipient_name is null or char_length(btrim(p_recipient_name)) not between 2 and 160 then
    raise exception 'Driver recipient name is required' using errcode = '22023';
  end if;
  if p_product_quantity_kg is null or p_product_quantity_kg <= 0 then
    raise exception 'A valid handed-over quantity is required' using errcode = '22023';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or (p_latitude is not null and p_latitude not between -90 and 90)
     or (p_longitude is not null and p_longitude not between -180 and 180)
     or (p_accuracy_m is not null and p_accuracy_m not between 0 and 100000) then
    raise exception 'Invalid handover GPS coordinates' using errcode = '22023';
  end if;
  if p_photo_path is null or p_supplier_signature_path is null
     or p_photo_path not like p_freight_load_id::text || '/' || v_actor::text || '/%'
     or p_supplier_signature_path not like p_freight_load_id::text || '/' || v_actor::text || '/%' then
    raise exception 'Invalid handover evidence storage paths' using errcode = '22023';
  end if;

  select fl.* into v_load
  from public.freight_loads fl
  where fl.id = p_freight_load_id
  for update;
  if not found then
    raise exception 'Freight load not found' using errcode = 'P0002';
  end if;
  if v_load.supplier_id is distinct from v_actor then
    raise exception 'Only the assigned supplier can issue the handover receipt' using errcode = '42501';
  end if;
  if v_load.status <> 'at_pickup' or v_load.driver_id is null then
    raise exception 'The assigned driver must be at the pickup point before handover' using errcode = '42501';
  end if;
  if v_load.vehicle_id is null then
    raise exception 'The driver must have an assigned vehicle before handover' using errcode = '42501';
  end if;
  if v_load.pre_order_id is not null and not exists (
    select 1 from public.pre_orders po
    where po.id = v_load.pre_order_id
      and po.payment_status = 'paid'
  ) then
    raise exception 'The order must be paid before the supplier hands over the load' using errcode = '42501';
  end if;
  if v_load.pre_order_id is not null and v_load.driver_quote_status is distinct from 'approved' then
    raise exception 'The buyer must approve the freight quote before handover' using errcode = '42501';
  end if;
  if exists (select 1 from public.freight_handover_evidence e where e.freight_load_id = v_load.id) then
    raise exception 'A supplier handover receipt already exists for this load' using errcode = '23505';
  end if;
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'freight-handover-evidence' and so.name = p_photo_path
  ) or not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'freight-handover-evidence' and so.name = p_supplier_signature_path
  ) then
    raise exception 'Handover photo and supplier signature must be uploaded first' using errcode = '22023';
  end if;

  insert into public.freight_handover_evidence (
    freight_load_id, supplier_id, driver_id, vehicle_id, recipient_name,
    product_quantity_kg, condition_notes, photo_path, supplier_signature_path,
    latitude, longitude, accuracy_m
  ) values (
    v_load.id, v_actor, v_load.driver_id, v_load.vehicle_id, btrim(p_recipient_name),
    p_product_quantity_kg, nullif(btrim(coalesce(p_condition_notes, '')), ''),
    p_photo_path, p_supplier_signature_path, p_latitude, p_longitude, p_accuracy_m
  ) returning id into v_evidence_id;

  update public.freight_loads
  set supplier_handover_confirmed_at = now(),
      updated_at = now()
  where id = v_load.id and status = 'at_pickup';

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  values (v_load.id, v_actor, 'supplier_handover');

  return v_evidence_id;
end;
$function$;

revoke all on function public.submit_supplier_handover_evidence(uuid, text, numeric, text, text, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.submit_supplier_handover_evidence(uuid, text, numeric, text, text, text, double precision, double precision, double precision) to authenticated;

create or replace function public.confirm_supplier_handover_receipt(p_freight_load_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_load public.freight_loads%rowtype;
  v_evidence_id uuid;
  v_acknowledged_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select fl.* into v_load
  from public.freight_loads fl
  where fl.id = p_freight_load_id
  for update;
  if not found then
    raise exception 'Freight load not found' using errcode = 'P0002';
  end if;
  if v_load.driver_id is distinct from v_actor then
    raise exception 'Only the assigned driver can acknowledge the supplier handover' using errcode = '42501';
  end if;
  if v_load.status <> 'at_pickup' then
    if v_load.status = 'in_transit' and v_load.supplier_handover_confirmed_at is not null then
      select e.id into v_evidence_id
      from public.freight_handover_evidence e
      where e.freight_load_id = v_load.id and e.driver_acknowledged_at is not null;
      if v_evidence_id is not null then return v_evidence_id; end if;
    end if;
    raise exception 'Load is not awaiting driver handover acknowledgement' using errcode = '42501';
  end if;

  select e.id into v_evidence_id
  from public.freight_handover_evidence e
  where e.freight_load_id = v_load.id
    and e.supplier_id = v_load.supplier_id
    and e.driver_id = v_actor
    and e.driver_acknowledged_at is null
  for update;
  if not found then
    raise exception 'Supplier handover receipt is not available for acknowledgement' using errcode = '42501';
  end if;

  v_acknowledged_at := now();

  update public.freight_handover_evidence
  set driver_acknowledged_at = v_acknowledged_at
  where id = v_evidence_id;

  update public.freight_loads
  set status = 'in_transit',
      driver_pickup_confirmed_at = coalesce(driver_pickup_confirmed_at, v_acknowledged_at),
      in_transit_at = coalesce(in_transit_at, v_acknowledged_at),
      updated_at = v_acknowledged_at
  where id = v_load.id and status = 'at_pickup';

  if not found then
    raise exception 'Freight load changed while handover was being acknowledged' using errcode = '40001';
  end if;

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  values (v_load.id, v_actor, 'driver_departure');

  insert into public.order_transaction_events (
    pre_order_id, order_id, freight_load_id, event_type, from_status, to_status, actor_id, metadata
  ) values (
    v_load.pre_order_id, v_load.order_id, v_load.id, 'supplier_handover_confirmed',
    'at_pickup', 'in_transit', v_actor,
    jsonb_build_object(
      'source', 'supplier_handover_evidence',
      'evidence_id', v_evidence_id,
      'acknowledged_at', v_acknowledged_at
    )
  );

  return v_evidence_id;
end;
$function$;

revoke all on function public.confirm_supplier_handover_receipt(uuid) from public, anon;
grant execute on function public.confirm_supplier_handover_receipt(uuid) to authenticated;

create or replace function public.guard_freight_supplier_handover_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'in_transit' and old.status is distinct from new.status
     and not exists (
       select 1
       from public.freight_handover_evidence e
       where e.freight_load_id = new.id
         and e.supplier_id = new.supplier_id
         and e.driver_id = new.driver_id
         and e.driver_acknowledged_at is not null
     ) then
    raise exception 'Supplier handover receipt and driver acknowledgement are required before transport'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_freight_supplier_handover_transition on public.freight_loads;
create trigger trg_guard_freight_supplier_handover_transition
before update of status on public.freight_loads
for each row execute function public.guard_freight_supplier_handover_transition();

revoke all on function public.guard_freight_supplier_handover_transition() from public, anon, authenticated;

create or replace function public.record_freight_load_location_batch(
  p_freight_load_id uuid,
  p_device_id uuid,
  p_samples jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_sample record;
  v_load public.freight_loads%rowtype;
  v_inserted uuid;
  v_accepted integer := 0;
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_device_id is null or jsonb_typeof(p_samples) is distinct from 'array' then
    raise exception 'A device identifier and sample array are required' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_samples);
  if v_count < 1 or v_count > 100 then
    raise exception 'A location batch must contain between 1 and 100 samples' using errcode = '22023';
  end if;
  select fl.* into v_load from public.freight_loads fl
  where fl.id = p_freight_load_id and fl.driver_id = v_actor and fl.status in ('in_transit', 'delivered');
  if not found then
    raise exception 'Only the assigned driver can synchronize locations for an active or recently delivered load' using errcode = '42501';
  end if;

  for v_sample in
    select *
    from jsonb_to_recordset(p_samples) as x(
      client_event_id uuid,
      device_sequence bigint,
      captured_at timestamptz,
      latitude double precision,
      longitude double precision,
      accuracy_m double precision,
      speed_mps double precision,
      heading_deg double precision
    )
    order by captured_at asc, device_sequence asc
  loop
    if v_sample.client_event_id is null
       or v_sample.device_sequence is null or v_sample.device_sequence < 1
       or v_sample.captured_at is null
       or v_sample.captured_at > now() + interval '5 minutes'
       or v_sample.captured_at < now() - interval '30 days'
       or v_sample.captured_at < coalesce(v_load.in_transit_at, v_load.accepted_at, v_load.created_at) - interval '5 minutes'
       or (v_load.delivered_at is not null and v_sample.captured_at > v_load.delivered_at)
       or v_sample.latitude is null or v_sample.latitude not between -90 and 90
       or v_sample.longitude is null or v_sample.longitude not between -180 and 180
       or (v_sample.accuracy_m is not null and v_sample.accuracy_m not between 0 and 100000)
       or (v_sample.speed_mps is not null and v_sample.speed_mps not between 0 and 100)
       or (v_sample.heading_deg is not null and v_sample.heading_deg not between 0 and 359.999999) then
      raise exception 'Invalid or out-of-window location sample' using errcode = '22023';
    end if;

    insert into public.freight_load_location_history (
      freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg,
      client_event_id, device_id, device_sequence, captured_at, received_at
    ) values (
      p_freight_load_id, v_sample.latitude, v_sample.longitude, v_sample.accuracy_m,
      v_sample.speed_mps, v_sample.heading_deg, v_sample.client_event_id,
      p_device_id, v_sample.device_sequence, v_sample.captured_at, now()
    )
    on conflict do nothing
    returning id into v_inserted;

    if v_inserted is not null then
      v_accepted := v_accepted + 1;
      insert into public.freight_load_locations (
        freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg,
        captured_at, received_at, recorded_at
      ) values (
        p_freight_load_id, v_sample.latitude, v_sample.longitude, v_sample.accuracy_m,
        v_sample.speed_mps, v_sample.heading_deg, v_sample.captured_at, now(), now()
      )
      on conflict (freight_load_id) do update
      set latitude = excluded.latitude,
          longitude = excluded.longitude,
          accuracy_m = excluded.accuracy_m,
          speed_mps = excluded.speed_mps,
          heading_deg = excluded.heading_deg,
          captured_at = excluded.captured_at,
          received_at = excluded.received_at,
          recorded_at = now()
      where excluded.captured_at >= public.freight_load_locations.captured_at;
    end if;
    v_inserted := null;
  end loop;

  return v_accepted;
end;
$function$;

revoke all on function public.record_freight_load_location_batch(uuid, uuid, jsonb) from public, anon;
grant execute on function public.record_freight_load_location_batch(uuid, uuid, jsonb) to authenticated;

create or replace function public.record_freight_load_location(
  p_freight_load_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_speed_mps double precision,
  p_heading_deg double precision,
  p_record_history boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_history_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.freight_loads fl
    where fl.id = p_freight_load_id and fl.driver_id = auth.uid() and fl.status = 'in_transit'
  ) then
    raise exception 'Only the assigned driver can share location while the load is in transit'
      using errcode = '42501';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or (p_accuracy_m is not null and p_accuracy_m not between 0 and 100000)
     or (p_speed_mps is not null and p_speed_mps not between 0 and 100)
     or (p_heading_deg is not null and p_heading_deg not between 0 and 359.999999) then
    raise exception 'Invalid GPS coordinates or metadata' using errcode = '22023';
  end if;

  if p_record_history then
    insert into public.freight_load_location_history (
      freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg,
      captured_at, received_at
    ) values (
      p_freight_load_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps,
      p_heading_deg, now(), now()
    ) returning id into v_history_id;
  end if;

  insert into public.freight_load_locations (
    freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg,
    captured_at, received_at, recorded_at
  ) values (
    p_freight_load_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps,
    p_heading_deg, now(), now(), now()
  )
  on conflict (freight_load_id) do update
  set latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_m = excluded.accuracy_m,
      speed_mps = excluded.speed_mps,
      heading_deg = excluded.heading_deg,
      captured_at = excluded.captured_at,
      received_at = excluded.received_at,
      recorded_at = now();

  return v_history_id;
end;
$function$;

revoke all on function public.record_freight_load_location(uuid, double precision, double precision, double precision, double precision, double precision, boolean) from public, anon;
grant execute on function public.record_freight_load_location(uuid, double precision, double precision, double precision, double precision, double precision, boolean) to authenticated;

commit;
