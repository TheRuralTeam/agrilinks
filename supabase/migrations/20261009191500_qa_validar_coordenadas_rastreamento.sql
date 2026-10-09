-- QA/logística: validar a telemetria recebida antes de gravar coordenadas.
-- Mantém a autorização existente: apenas o motorista atribuído pode reportar
-- localização enquanto a carga está em trânsito.

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
    select 1
    from public.freight_loads as load
    where load.id = p_freight_load_id
      and load.driver_id = auth.uid()
      and load.status = 'in_transit'
  ) then
    raise exception 'Only the assigned driver can share location while the load is in transit'
      using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null
    or p_latitude < -90 or p_latitude > 90
    or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid GPS coordinates' using errcode = '22023';
  end if;

  if p_accuracy_m is not null and (p_accuracy_m < 0 or p_accuracy_m > 100000) then
    raise exception 'Invalid GPS accuracy' using errcode = '22023';
  end if;

  if p_speed_mps is not null and (p_speed_mps < 0 or p_speed_mps > 100) then
    raise exception 'Invalid GPS speed' using errcode = '22023';
  end if;

  if p_heading_deg is not null and (p_heading_deg < 0 or p_heading_deg >= 360) then
    raise exception 'Invalid GPS heading' using errcode = '22023';
  end if;

  if p_record_history then
    insert into public.freight_load_location_history (
      freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg
    )
    values (
      p_freight_load_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps, p_heading_deg
    )
    returning id into v_history_id;
  end if;

  insert into public.freight_load_locations (
    freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg
  )
  values (
    p_freight_load_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps, p_heading_deg
  )
  on conflict (freight_load_id) do update
  set latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_m = excluded.accuracy_m,
      speed_mps = excluded.speed_mps,
      heading_deg = excluded.heading_deg,
      recorded_at = now();

  return v_history_id;
end;
$function$;

revoke all on function public.record_freight_load_location(uuid,double precision,double precision,double precision,double precision,double precision,boolean) from public, anon;
grant execute on function public.record_freight_load_location(uuid,double precision,double precision,double precision,double precision,double precision,boolean) to authenticated;
