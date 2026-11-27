-- End-to-end database test for the evidence-backed freight lifecycle.
do $test$
declare
  v_driver constant uuid := '10000000-0000-0000-0000-000000000001';
  v_buyer constant uuid := '10000000-0000-0000-0000-000000000002';
  v_supplier constant uuid := '10000000-0000-0000-0000-000000000003';
  v_other constant uuid := '10000000-0000-0000-0000-000000000004';
  v_pre_order constant uuid := '20000000-0000-0000-0000-000000000001';
  v_unpaid_pre_order constant uuid := '20000000-0000-0000-0000-000000000002';
  v_load constant uuid := '30000000-0000-0000-0000-000000000001';
  v_blocked_load constant uuid := '30000000-0000-0000-0000-000000000002';
  v_unpaid_load constant uuid := '30000000-0000-0000-0000-000000000003';
  v_photo_path text;
  v_signature_path text;
  v_evidence_id uuid;
  v_evidence jsonb;
  v_event_count integer;
begin
  insert into public.users (id, user_type, email_verified) values
    (v_driver, 'motorista', true),
    (v_buyer, 'comprador', true),
    (v_supplier, 'agricultor', true),
    (v_other, 'comprador', true);

  insert into public.pre_orders (id, status, payment_status)
  values
    (v_pre_order, 'accepted', 'paid'),
    (v_unpaid_pre_order, 'accepted', 'unpaid');

  insert into public.freight_loads (
    id, created_by, driver_id, buyer_id, supplier_id, pre_order_id,
    status, driver_quote_status
  ) values (
    v_load, v_supplier, v_driver, v_buyer, v_supplier, v_pre_order,
    'accepted', 'approved'
  );

  -- Driver reaches the pickup point.
  perform set_config('request.jwt.claim.sub', v_driver::text, true);
  perform * from public.advance_freight_load_status(v_load, 'at_pickup');

  -- Seed the private supplier receipt row as if the authenticated supplier RPC
  -- had uploaded its photo and signature. The separate handover contract test
  -- verifies that only the assigned, paid supplier can create this row.
  insert into public.freight_handover_evidence (
    freight_load_id, supplier_id, driver_id, recipient_name,
    product_quantity_kg, photo_path, supplier_signature_path
  ) values (
    v_load, v_supplier, v_driver, 'Destinatário de Teste', 100,
    v_load::text || '/' || v_supplier::text || '/handover-photo.jpg',
    v_load::text || '/' || v_supplier::text || '/supplier-signature.png'
  );

  update public.freight_loads
  set supplier_handover_confirmed_at = now()
  where id = v_load and status = 'at_pickup';

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  values (v_load, v_supplier, 'supplier_handover');

  -- The driver must acknowledge the supplier receipt before the trip starts.
  perform set_config('request.jwt.claim.sub', v_driver::text, true);
  perform public.confirm_supplier_handover_receipt(v_load);

  v_photo_path := v_load::text || '/' || v_driver::text || '/photo.jpg';
  v_signature_path := v_load::text || '/' || v_driver::text || '/signature.png';

  insert into storage.objects (bucket_id, name) values
    ('freight-delivery-evidence', v_photo_path),
    ('freight-delivery-evidence', v_signature_path);

  -- Direct status advancement cannot bypass the persisted delivery evidence.
  begin
    perform * from public.advance_freight_load_status(v_load, 'delivered');
    raise exception 'Driver marked load delivered without evidence';
  exception when insufficient_privilege then
    null;
  end;
  if (select status from public.freight_loads where id = v_load) <> 'in_transit' then
    raise exception 'Load changed to delivered without evidence';
  end if;

  -- Driver submits recipient, photo, signature and GPS; the load becomes delivered atomically.
  select public.submit_freight_delivery_evidence(
    v_load,
    'Destinatário de Teste',
    v_photo_path,
    v_signature_path,
    -8.838333,
    13.234444,
    12.5
  ) into v_evidence_id;

  if v_evidence_id is null then
    raise exception 'Delivery evidence ID was not returned';
  end if;

  if (select status from public.freight_loads where id = v_load) <> 'delivered' then
    raise exception 'The load was not marked delivered after valid proof';
  end if;

  -- Buyer can inspect the evidence and then confirm receipt.
  perform set_config('request.jwt.claim.sub', v_buyer::text, true);
  select public.get_freight_delivery_evidence(v_load) into v_evidence;
  if v_evidence->>'recipient_name' <> 'Destinatário de Teste'
     or v_evidence->>'photo_path' <> v_photo_path
     or v_evidence->>'signature_path' <> v_signature_path then
    raise exception 'Buyer could not retrieve the complete delivery evidence';
  end if;

  perform public.confirm_freight_receipt(v_load);
  perform public.confirm_freight_receipt(v_load); -- idempotency

  if (select status from public.pre_orders where id = v_pre_order) <> 'accepted' then
    raise exception 'Buyer receipt confirmation must not overwrite the pre-order acceptance state';
  end if;

  if (select buyer_receipt_confirmed_at from public.freight_loads where id = v_load) is null then
    raise exception 'Buyer receipt timestamp was not persisted';
  end if;

  select count(*) into v_event_count
  from public.freight_load_events
  where freight_load_id = v_load and event_type = 'buyer_received';
  if v_event_count <> 1 then
    raise exception 'Buyer receipt event is not idempotent';
  end if;

  if not exists (
    select 1 from public.order_transaction_events
    where freight_load_id = v_load
      and event_type = 'buyer_receipt_confirmed'
      and from_status = 'delivered'
      and to_status = 'buyer_received'
  ) then
    raise exception 'Buyer receipt transaction event does not preserve the distinct receipt state';
  end if;

  select count(*) into v_event_count
  from public.freight_load_events
  where freight_load_id = v_load and event_type = 'driver_departure';
  if v_event_count <> 1 then
    raise exception 'Driver departure event was not recorded distinctly';
  end if;

  select count(*) into v_event_count
  from public.order_transaction_events
  where freight_load_id = v_load and event_type = 'supplier_handover_confirmed';
  if v_event_count <> 1 then
    raise exception 'Supplier handover was not written to the transaction history';
  end if;

  -- The legacy timestamp-only supplier RPC is disabled; only the evidence-backed RPC remains available.
  insert into public.freight_loads (
    id, created_by, driver_id, buyer_id, supplier_id, pre_order_id,
    status, driver_quote_status
  ) values (
    v_unpaid_load, v_supplier, v_driver, v_buyer, v_supplier, v_unpaid_pre_order,
    'at_pickup', 'approved'
  );

  perform set_config('request.jwt.claim.sub', v_supplier::text, true);
  begin
    perform public.confirm_supplier_handover(v_unpaid_load);
    raise exception 'Supplier released goods before payment';
  exception when insufficient_privilege then
    null;
  end;

  if (select supplier_handover_confirmed_at from public.freight_loads where id = v_unpaid_load) is not null then
    raise exception 'Unpaid order unexpectedly passed supplier handover';
  end if;

  -- An unrelated account cannot read the private delivery evidence.
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.get_freight_delivery_evidence(v_load);
    raise exception 'An unrelated account unexpectedly read delivery evidence';
  exception when insufficient_privilege then
    null;
  end;

  -- A driver cannot start a second trip without supplier handover.
  insert into public.freight_loads (
    id, created_by, driver_id, buyer_id, supplier_id, pre_order_id,
    status, driver_quote_status
  ) values (
    v_blocked_load, v_supplier, v_driver, v_buyer, v_supplier, v_pre_order,
    'at_pickup', 'approved'
  );

  perform set_config('request.jwt.claim.sub', v_driver::text, true);
  begin
    perform * from public.advance_freight_load_status(v_blocked_load, 'in_transit');
    raise exception 'Driver departed without supplier handover';
  exception when insufficient_privilege then
    null;
  end;

  if (select status from public.freight_loads where id = v_blocked_load) <> 'at_pickup' then
    raise exception 'Blocked load changed state despite missing supplier handover';
  end if;

  raise notice 'PASS: delivery evidence, supplier handover, buyer receipt, authorization and idempotency';
end;
$test$;
