-- Centralized marketplace payment allocations.
-- Buyer pays one total to AgriLink; allocations remain blocked until buyer receipt.
-- The existing freight policy applies an 8% AgriLink fee to freight; the remainder
-- is allocated to the driver. Product value is allocated to the supplier.

begin;

-- Platform fees belong to AgriLink, not to a fictitious user beneficiary.
alter table public.payment_allocations
  alter column recipient_user_id drop not null;

alter table public.payment_allocations
  drop constraint if exists payment_allocations_recipient_type_check;
alter table public.payment_allocations
  add constraint payment_allocations_recipient_type_check
  check (
    (allocation_type = 'platform_fee' and recipient_user_id is null)
    or (allocation_type <> 'platform_fee' and recipient_user_id is not null)
  );

create unique index if not exists ux_payment_allocations_platform_fee
  on public.payment_allocations(payment_intent_id, allocation_type)
  where allocation_type = 'platform_fee';

create or replace function public.create_marketplace_payment_allocations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.pre_orders%rowtype;
  v_load public.freight_loads%rowtype;
  v_supplier_id uuid;
  v_order_id uuid;
  v_product_amount numeric(15,2);
  v_freight_amount numeric(15,2);
  v_platform_fee numeric(15,2);
  v_driver_amount numeric(15,2);
  v_expected_total numeric(15,2);
  v_allocation_total numeric(15,2);
begin
  if new.status <> 'succeeded'
     or old.status = 'succeeded'
     or new.purpose <> 'order_payment' then
    return new;
  end if;

  if new.pre_order_id is null then
    raise exception 'ORDER_PAYMENT_REQUIRES_PRE_ORDER' using errcode = '23514';
  end if;

  select po.* into v_order
  from public.pre_orders po
  where po.id = new.pre_order_id
    and po.user_id = new.user_id
    and po.status = 'accepted'
  for update;

  if not found then
    raise exception 'ORDER_NOT_PAYABLE_FOR_ALLOCATION' using errcode = '23514';
  end if;

  select p.user_id into v_supplier_id
  from public.products p
  where p.id = v_order.product_id;

  if v_supplier_id is null or v_supplier_id = v_order.user_id then
    raise exception 'VALID_SUPPLIER_NOT_FOUND' using errcode = '23514';
  end if;

  select fl.* into v_load
  from public.freight_loads fl
  where fl.pre_order_id = v_order.id
  order by fl.created_at desc
  limit 1
  for update;

  if not found
     or v_load.driver_id is null
     or v_load.driver_quote_status <> 'approved' then
    raise exception 'APPROVED_DRIVER_QUOTE_REQUIRED_FOR_ALLOCATION' using errcode = '23514';
  end if;

  v_product_amount := round(v_order.total_price, 2);
  v_freight_amount := round(coalesce(v_load.offered_price, v_load.driver_offered_price, 0), 2);
  v_platform_fee := round(v_freight_amount * 0.08, 2);
  v_driver_amount := round(v_freight_amount - v_platform_fee, 2);
  v_expected_total := round(v_product_amount + v_freight_amount, 2);

  if v_product_amount <= 0
     or v_freight_amount <= 0
     or v_driver_amount <= 0
     or round(new.amount, 2) <> v_expected_total
     or new.currency <> 'AOA' then
    raise exception 'PAYMENT_TOTAL_DOES_NOT_MATCH_ORDER_AND_FREIGHT' using errcode = '23514';
  end if;

  select o.id into v_order_id
  from public.orders o
  where o.pre_order_id = v_order.id
  order by o.created_at desc nulls last
  limit 1;

  v_allocation_total := round(v_product_amount + v_driver_amount + v_platform_fee, 2);
  if v_allocation_total <> v_expected_total then
    raise exception 'PAYMENT_ALLOCATION_TOTAL_MISMATCH' using errcode = '23514';
  end if;

  insert into public.payment_allocations (
    payment_intent_id, order_id, recipient_user_id, allocation_type,
    amount, currency, status, metadata
  )
  values
    (
      new.id, v_order_id, v_supplier_id, 'seller',
      v_product_amount, 'AOA', 'blocked',
      jsonb_build_object(
        'pre_order_id', v_order.id,
        'freight_load_id', v_load.id,
        'allocation_basis', 'product_total',
        'release_gate', 'buyer_receipt_confirmation',
        'allocation_version', 1
      )
    ),
    (
      new.id, v_order_id, v_load.driver_id, 'driver',
      v_driver_amount, 'AOA', 'blocked',
      jsonb_build_object(
        'pre_order_id', v_order.id,
        'freight_load_id', v_load.id,
        'gross_freight_amount', v_freight_amount,
        'platform_fee_amount', v_platform_fee,
        'platform_fee_rate', 0.08,
        'allocation_basis', 'approved_freight_net_of_existing_platform_fee',
        'release_gate', 'buyer_receipt_confirmation',
        'allocation_version', 1
      )
    ),
    (
      new.id, v_order_id, null, 'platform_fee',
      v_platform_fee, 'AOA', 'blocked',
      jsonb_build_object(
        'pre_order_id', v_order.id,
        'freight_load_id', v_load.id,
        'fee_source', 'existing_freight_settlement_policy',
        'fee_rate', 0.08,
        'allocation_version', 1
      )
    )
  on conflict (payment_intent_id, recipient_user_id, allocation_type) do nothing;

  if (
    select round(coalesce(sum(pa.amount), 0), 2)
    from public.payment_allocations pa
    where pa.payment_intent_id = new.id
  ) <> v_expected_total then
    raise exception 'PERSISTED_PAYMENT_ALLOCATIONS_DO_NOT_RECONCILE' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_marketplace_payment_allocations on public.payment_intents;
create trigger trg_create_marketplace_payment_allocations
after update of status on public.payment_intents
for each row
when (new.status = 'succeeded' and old.status is distinct from new.status)
execute function public.create_marketplace_payment_allocations();

revoke all on function public.create_marketplace_payment_allocations() from public, anon, authenticated;

-- Keep the legacy driver settlement record aligned with the same approved
-- freight amount used by checkout, including the driver's quoted-price fallback.
create or replace function public.create_freight_settlement_if_ready(p_freight_load_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_load record;
  v_gross_amount numeric(15,2);
  v_commission numeric(15,2);
begin
  select l.id, l.driver_id, l.currency,
         coalesce(l.offered_price, l.driver_offered_price, 0) as freight_amount
  into v_load
  from public.freight_loads l
  where l.id = p_freight_load_id
    and l.status = 'delivered'
    and l.supplier_handover_confirmed_at is not null
    and l.driver_pickup_confirmed_at is not null
    and l.driver_delivery_confirmed_at is not null
    and l.buyer_receipt_confirmed_at is not null;

  if not found or v_load.driver_id is null or v_load.freight_amount <= 0 then
    return;
  end if;

  v_gross_amount := round(v_load.freight_amount, 2);
  v_commission := round(v_gross_amount * 0.08, 2);

  insert into public.freight_settlements (
    freight_load_id, driver_id, currency, gross_amount,
    agrilink_commission, driver_amount
  )
  values (
    v_load.id, v_load.driver_id,
    coalesce(nullif(v_load.currency, ''), 'Kz'),
    v_gross_amount, v_commission,
    round(v_gross_amount - v_commission, 2)
  )
  on conflict (freight_load_id) do nothing;
end;
$$;

revoke all on function public.create_freight_settlement_if_ready(uuid) from public, anon, authenticated;
grant execute on function public.create_freight_settlement_if_ready(uuid) to service_role;

-- A delivery declaration alone is not enough. The allocations are released only
-- when the buyer confirms receipt after the evidence-backed delivery transition.
create or replace function public.release_marketplace_allocations_after_buyer_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_payment_status text;
begin
  if old.buyer_receipt_confirmed_at is not null
     or new.buyer_receipt_confirmed_at is null then
    return new;
  end if;

  if new.status <> 'delivered'
     or new.driver_id is null
     or new.supplier_handover_confirmed_at is null
     or new.driver_pickup_confirmed_at is null
     or new.driver_delivery_confirmed_at is null
     or not exists (
       select 1
       from public.freight_delivery_evidence de
       where de.freight_load_id = new.id
         and de.driver_id = new.driver_id
     ) then
    raise exception 'EVIDENCE_BACKED_DELIVERY_REQUIRED_BEFORE_RELEASE' using errcode = '23514';
  end if;

  if new.pre_order_id is not null then
    select po.payment_status into v_order_payment_status
    from public.pre_orders po
    where po.id = new.pre_order_id
    for update;

    if v_order_payment_status is distinct from 'paid' then
      raise exception 'PAID_ORDER_REQUIRED_BEFORE_RELEASE' using errcode = '23514';
    end if;
  end if;

  update public.payment_allocations pa
  set status = 'available',
      released_at = coalesce(pa.released_at, now()),
      metadata = pa.metadata || jsonb_build_object(
        'released_by_gate', 'buyer_receipt_confirmation',
        'buyer_receipt_confirmed_at', new.buyer_receipt_confirmed_at
      )
  where pa.status = 'blocked'
    and pa.metadata->>'freight_load_id' = new.id::text;

  -- Preserve the existing driver settlement record even for legacy paid orders
  -- that predate allocation creation. The function is idempotent by freight_load_id.
  perform public.create_freight_settlement_if_ready(new.id);

  return new;
end;
$$;

drop trigger if exists trg_release_marketplace_allocations_after_buyer_receipt on public.freight_loads;
create trigger trg_release_marketplace_allocations_after_buyer_receipt
after update of buyer_receipt_confirmed_at on public.freight_loads
for each row
execute function public.release_marketplace_allocations_after_buyer_receipt();

revoke all on function public.release_marketplace_allocations_after_buyer_receipt() from public, anon, authenticated;

alter table public.payment_allocations enable row level security;
revoke all on public.payment_allocations from anon, authenticated;
grant select on public.payment_allocations to authenticated;

drop policy if exists "Payment participants can read allocations" on public.payment_allocations;
create policy "Payment participants can read allocations"
on public.payment_allocations
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or exists (
    select 1
    from public.payment_intents pi
    where pi.id = payment_allocations.payment_intent_id
      and pi.user_id = auth.uid()
  )
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

comment on function public.create_marketplace_payment_allocations() is
  'Creates idempotent blocked supplier, driver and platform-fee allocations after verified marketplace payment success.';
comment on function public.release_marketplace_allocations_after_buyer_receipt() is
  'Makes blocked marketplace allocations available only after evidence-backed delivery and buyer receipt confirmation.';

commit;
