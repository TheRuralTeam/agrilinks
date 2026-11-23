-- Evidence-backed delivery lifecycle for marketplace pre-orders.
-- Additive and isolated: delivery proof is stored separately from the commercial receipt.
begin;

alter table public.freight_loads
  add column if not exists driver_arrived_at timestamptz,
  add column if not exists supplier_handover_confirmed_at timestamptz,
  add column if not exists driver_delivery_confirmed_at timestamptz,
  add column if not exists buyer_receipt_confirmed_at timestamptz;

create table if not exists public.freight_delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  freight_load_id uuid not null unique references public.freight_loads(id) on delete restrict,
  driver_id uuid not null references public.users(id) on delete restrict,
  recipient_name text not null check (char_length(btrim(recipient_name)) between 2 and 160),
  photo_path text not null,
  signature_path text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m between 0 and 100000),
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint freight_delivery_evidence_photo_path_check
    check (photo_path like freight_load_id::text || '/' || driver_id::text || '/%'),
  constraint freight_delivery_evidence_signature_path_check
    check (signature_path like freight_load_id::text || '/' || driver_id::text || '/%')
);

create index if not exists idx_freight_delivery_evidence_driver
  on public.freight_delivery_evidence(driver_id, created_at desc);

alter table public.freight_delivery_evidence enable row level security;
revoke all on public.freight_delivery_evidence from anon, authenticated;
drop policy if exists "Freight participants can read delivery evidence" on public.freight_delivery_evidence;
create policy "Freight participants can read delivery evidence"
on public.freight_delivery_evidence for select to authenticated
using (
  exists (
    select 1
    from public.freight_loads fl
    where fl.id = freight_delivery_evidence.freight_load_id
      and auth.uid() in (fl.buyer_id, fl.supplier_id, fl.driver_id, fl.created_by)
  )
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'freight-delivery-evidence',
  'freight-delivery-evidence',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

drop policy if exists "Assigned drivers upload delivery evidence" on storage.objects;
create policy "Assigned drivers upload delivery evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'freight-delivery-evidence'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.freight_loads fl
    where fl.id::text = (storage.foldername(name))[1]
      and fl.driver_id = auth.uid()
      and fl.status = 'in_transit'
  )
);

drop policy if exists "Freight participants read delivery evidence files" on storage.objects;
create policy "Freight participants read delivery evidence files"
on storage.objects for select to authenticated
using (
  bucket_id = 'freight-delivery-evidence'
  and exists (
    select 1
    from public.freight_loads fl
    where fl.id::text = (storage.foldername(name))[1]
      and auth.uid() in (fl.buyer_id, fl.supplier_id, fl.driver_id, fl.created_by)
  )
);

drop policy if exists "Assigned drivers delete unsubmitted delivery evidence" on storage.objects;
create policy "Assigned drivers delete unsubmitted delivery evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'freight-delivery-evidence'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.freight_loads fl
    where fl.id::text = (storage.foldername(name))[1]
      and fl.driver_id = auth.uid()
      and fl.status = 'in_transit'
      and not exists (
        select 1 from public.freight_delivery_evidence de
        where de.freight_load_id = fl.id
      )
  )
);

-- Direct client writes to the proof ledger are intentionally disabled.
create or replace function public.guard_freight_delivery_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from new.status
     and not exists (
       select 1 from public.freight_delivery_evidence de
       where de.freight_load_id = new.id
         and de.driver_id = new.driver_id
     ) then
    raise exception 'A valid driver delivery evidence record is required before marking a load delivered'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_freight_delivery_status on public.freight_loads;
create trigger trg_guard_freight_delivery_status
before update of status on public.freight_loads
for each row execute function public.guard_freight_delivery_status();
revoke all on function public.guard_freight_delivery_status() from public, anon, authenticated;

create or replace function public.submit_freight_delivery_evidence(
  p_freight_load_id uuid,
  p_recipient_name text,
  p_photo_path text,
  p_signature_path text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_load public.freight_loads%rowtype;
  v_evidence_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_recipient_name is null or char_length(btrim(p_recipient_name)) not between 2 and 160 then
    raise exception 'Recipient name is required' using errcode = '22023';
  end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180
     or (p_accuracy_m is not null and p_accuracy_m not between 0 and 100000) then
    raise exception 'Valid delivery GPS coordinates are required' using errcode = '22023';
  end if;
  if p_photo_path is null or p_signature_path is null
     or p_photo_path not like p_freight_load_id::text || '/' || v_actor::text || '/%'
     or p_signature_path not like p_freight_load_id::text || '/' || v_actor::text || '/%' then
    raise exception 'Invalid evidence storage paths' using errcode = '22023';
  end if;

  select fl.* into v_load
  from public.freight_loads fl
  where fl.id = p_freight_load_id
  for update;
  if not found then
    raise exception 'Freight load not found' using errcode = 'P0002';
  end if;
  if v_load.driver_id is distinct from v_actor or v_load.status <> 'in_transit' then
    raise exception 'Only the assigned driver can submit proof for an in-transit load' using errcode = '42501';
  end if;
  if exists (select 1 from public.freight_delivery_evidence de where de.freight_load_id = v_load.id) then
    raise exception 'Delivery evidence has already been submitted' using errcode = '23505';
  end if;
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'freight-delivery-evidence' and so.name = p_photo_path
  ) or not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'freight-delivery-evidence' and so.name = p_signature_path
  ) then
    raise exception 'Both the delivery photo and recipient signature must be uploaded first' using errcode = '22023';
  end if;

  insert into public.freight_delivery_evidence (
    freight_load_id, driver_id, recipient_name, photo_path, signature_path,
    latitude, longitude, accuracy_m
  ) values (
    v_load.id, v_actor, btrim(p_recipient_name), p_photo_path, p_signature_path,
    p_latitude, p_longitude, p_accuracy_m
  ) returning id into v_evidence_id;

  update public.freight_loads
  set status = 'delivered',
      delivered_at = coalesce(delivered_at, now()),
      driver_delivery_confirmed_at = coalesce(driver_delivery_confirmed_at, now()),
      updated_at = now()
  where id = v_load.id and status = 'in_transit';

  if not found then
    raise exception 'Freight load changed while delivery proof was being submitted' using errcode = '40001';
  end if;

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  values (v_load.id, v_actor, 'driver_delivery');

  return v_evidence_id;
end;
$$;

revoke all on function public.submit_freight_delivery_evidence(uuid, text, text, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.submit_freight_delivery_evidence(uuid, text, text, text, double precision, double precision, double precision) to authenticated;

-- Buyer confirmation is a separate step from the driver's delivery declaration.
create or replace function public.confirm_freight_receipt(p_freight_load_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_load public.freight_loads%rowtype;
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
  if v_load.buyer_id is distinct from v_actor then
    raise exception 'Only the buyer assigned to this order can confirm receipt' using errcode = '42501';
  end if;
  if v_load.status <> 'delivered'
     or not exists (
       select 1 from public.freight_delivery_evidence de
       where de.freight_load_id = v_load.id
         and de.driver_id = v_load.driver_id
     ) then
    raise exception 'The driver must submit valid delivery evidence before receipt confirmation' using errcode = '42501';
  end if;
  if v_load.buyer_receipt_confirmed_at is not null then
    return;
  end if;

  update public.freight_loads
  set buyer_receipt_confirmed_at = now(), updated_at = now()
  where id = v_load.id and buyer_receipt_confirmed_at is null;

  if v_load.pre_order_id is not null then
    update public.pre_orders
    set status = 'completed', updated_at = now()
    where id = v_load.pre_order_id and status = 'accepted';
  end if;

  insert into public.order_transaction_events (
    pre_order_id, order_id, freight_load_id, event_type, from_status, to_status, actor_id, metadata
  ) values (
    v_load.pre_order_id, v_load.order_id, v_load.id, 'buyer_receipt_confirmed',
    'delivered', 'completed', v_actor,
    jsonb_build_object('source', 'buyer_confirmation', 'confirmed_at', now())
  );
end;
$$;

revoke all on function public.confirm_freight_receipt(uuid) from public, anon;
grant execute on function public.confirm_freight_receipt(uuid) to authenticated;


-- Supplier handover is a distinct, auditable gate before the driver starts the loaded trip.
create or replace function public.confirm_supplier_handover(p_freight_load_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
  v_load public.freight_loads%rowtype;
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
  if v_load.supplier_id is distinct from v_actor then
    raise exception 'Only the supplier assigned to this order can confirm handover' using errcode = '42501';
  end if;
  if v_load.driver_id is null or v_load.status <> 'at_pickup' then
    raise exception 'The assigned driver must be at the pickup point before handover' using errcode = '22023';
  end if;
  if v_load.supplier_handover_confirmed_at is not null then
    return v_load.supplier_handover_confirmed_at;
  end if;

  update public.freight_loads
  set supplier_handover_confirmed_at = now(), updated_at = now()
  where id = v_load.id and status = 'at_pickup'
    and supplier_handover_confirmed_at is null;

  if not found then
    raise exception 'Supplier handover state changed concurrently' using errcode = '40001';
  end if;

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  values (v_load.id, v_actor, 'supplier_handover');

  return (select fl.supplier_handover_confirmed_at from public.freight_loads fl where fl.id = v_load.id);
end;
$;

revoke all on function public.confirm_supplier_handover(uuid) from public, anon;
grant execute on function public.confirm_supplier_handover(uuid) to authenticated;

create or replace function public.guard_freight_handover_before_transit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if new.status = 'in_transit' and old.status is distinct from new.status
     and new.supplier_handover_confirmed_at is null then
    raise exception 'Supplier handover confirmation is required before the loaded trip starts'
      using errcode = '42501';
  end if;
  return new;
end;
$;

drop trigger if exists trg_guard_freight_handover_before_transit on public.freight_loads;
create trigger trg_guard_freight_handover_before_transit
before update of status on public.freight_loads
for each row execute function public.guard_freight_handover_before_transit();
revoke all on function public.guard_freight_handover_before_transit() from public, anon, authenticated;


create or replace function public.get_freight_delivery_evidence(p_freight_load_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
  v_load public.freight_loads%rowtype;
  v_evidence public.freight_delivery_evidence%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select fl.* into v_load
  from public.freight_loads fl
  where fl.id = p_freight_load_id;
  if not found then
    raise exception 'Freight load not found' using errcode = 'P0002';
  end if;
  if not (
    v_actor in (v_load.buyer_id, v_load.supplier_id, v_load.driver_id, v_load.created_by)
    or public.has_role(v_actor, 'admin'::public.app_role)
  ) then
    raise exception 'Delivery evidence access denied' using errcode = '42501';
  end if;
  select de.* into v_evidence
  from public.freight_delivery_evidence de
  where de.freight_load_id = v_load.id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_evidence.id,
    'freight_load_id', v_evidence.freight_load_id,
    'driver_id', v_evidence.driver_id,
    'recipient_name', v_evidence.recipient_name,
    'photo_path', v_evidence.photo_path,
    'signature_path', v_evidence.signature_path,
    'latitude', v_evidence.latitude,
    'longitude', v_evidence.longitude,
    'accuracy_m', v_evidence.accuracy_m,
    'delivered_at', v_evidence.delivered_at
  );
end;
$;

revoke all on function public.get_freight_delivery_evidence(uuid) from public, anon;
grant execute on function public.get_freight_delivery_evidence(uuid) to authenticated;

commit;
