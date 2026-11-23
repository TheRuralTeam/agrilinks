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
  on conflict do nothing;

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

-- Separate payout instructions for supplier and driver. These are internal
-- payout intents only; no bank transfer is simulated or marked successful.
create table if not exists public.marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  payment_allocation_id uuid not null unique references public.payment_allocations(id) on delete restrict,
  recipient_user_id uuid not null references public.users(id) on delete restrict,
  payout_type text not null check (payout_type in ('seller','driver')),
  amount numeric(15,2) not null check (amount > 0),
  currency char(3) not null default 'AOA',
  status text not null default 'awaiting_beneficiary_verification'
    check (status in (
      'awaiting_beneficiary_verification',
      'awaiting_manual_payout',
      'processing',
      'paid',
      'failed',
      'blocked',
      'cancelled'
    )),
  provider_reference text,
  payout_reference text,
  proof_url text,
  failure_reason text,
  paid_at timestamptz,
  paid_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_payouts_paid_reference_check
    check (status <> 'paid' or (paid_at is not null and payout_reference is not null))
);

create index if not exists idx_marketplace_payouts_recipient_status
  on public.marketplace_payouts(recipient_user_id, status, created_at desc);

create or replace function public.create_marketplace_payout_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$

begin
  if new.status <> 'available'
     or old.status = 'available'
     or new.allocation_type not in ('seller','driver')
     or new.recipient_user_id is null then
    return new;
  end if;

  insert into public.marketplace_payouts (
    payment_allocation_id, recipient_user_id, payout_type, amount, currency
  )
  values (
    new.id, new.recipient_user_id, new.allocation_type, new.amount, new.currency
  )
  on conflict (payment_allocation_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_create_marketplace_payout_intent on public.payment_allocations;
create trigger trg_create_marketplace_payout_intent
after update of status on public.payment_allocations
for each row
when (new.status = 'available' and old.status is distinct from new.status)
execute function public.create_marketplace_payout_intent();

alter table public.marketplace_payouts enable row level security;
revoke all on public.marketplace_payouts from anon, authenticated;
grant select on public.marketplace_payouts to authenticated;

drop policy if exists "Payout participants can read their payout status" on public.marketplace_payouts;
create policy "Payout participants can read their payout status"
on public.marketplace_payouts
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role)
);

revoke all on function public.create_marketplace_payout_intent() from public, anon, authenticated;

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
  or public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role)
);

comment on function public.create_marketplace_payment_allocations() is
  'Creates idempotent blocked supplier, driver and platform-fee allocations after verified marketplace payment success.';
comment on function public.release_marketplace_allocations_after_buyer_receipt() is
  'Makes blocked marketplace allocations available only after evidence-backed delivery and buyer receipt confirmation.';


-- Verified payout destinations are provider/vault references only. Raw bank
-- account numbers and IBANs must never be stored in this application table.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-payout-proofs',
  'marketplace-payout-proofs',
  false,
  8388608,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']::text[];

drop policy if exists "Admins upload marketplace payout proofs" on storage.objects;
create policy "Admins upload marketplace payout proofs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketplace-payout-proofs'
  and (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role))
);

drop policy if exists "Admins read marketplace payout proofs" on storage.objects;
create policy "Admins read marketplace payout proofs"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-payout-proofs'
  and (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role))
);

create table if not exists public.marketplace_payout_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  channel text not null check (channel in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay')),
  provider_beneficiary_ref text not null unique,
  account_holder text not null check (char_length(btrim(account_holder)) between 2 and 160),
  masked_account_label text not null check (char_length(btrim(masked_account_label)) between 3 and 80),
  currency char(3) not null default 'AOA' check (currency = 'AOA'),
  status text not null default 'pending'
    check (status in ('pending','verified','rejected','disabled')),
  verified_at timestamptz,
  verified_by uuid references public.users(id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_payout_beneficiary_verification_check
    check (
      (status = 'verified' and verified_at is not null and verified_by is not null)
      or status <> 'verified'
    )
);

create unique index if not exists ux_marketplace_payout_one_verified_beneficiary
  on public.marketplace_payout_beneficiaries(user_id)
  where status = 'verified';

alter table public.marketplace_payouts
  add column if not exists beneficiary_id uuid
    references public.marketplace_payout_beneficiaries(id) on delete restrict;

create table if not exists public.marketplace_payout_audit (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid references public.marketplace_payouts(id) on delete restrict,
  beneficiary_id uuid references public.marketplace_payout_beneficiaries(id) on delete restrict,
  actor_id uuid not null references public.users(id) on delete restrict,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_payout_audit_target_check
    check (num_nonnulls(payout_id, beneficiary_id) = 1)
);

alter table public.marketplace_payout_beneficiaries enable row level security;
alter table public.marketplace_payout_audit enable row level security;
revoke all on public.marketplace_payout_beneficiaries from anon, authenticated;
revoke all on public.marketplace_payout_audit from anon, authenticated;
grant select (id, user_id, channel, account_holder, masked_account_label, currency, status, verified_at, created_at)
  on public.marketplace_payout_beneficiaries to authenticated;
create policy "Recipients and admins can read payout beneficiary status"
on public.marketplace_payout_beneficiaries
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role)
);
grant select on public.marketplace_payout_audit to authenticated;
create policy "Admins can read payout audit"
on public.marketplace_payout_audit
for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.admin_register_marketplace_payout_beneficiary(
  p_user_id uuid,
  p_channel text,
  p_provider_beneficiary_ref text,
  p_account_holder text,
  p_masked_account_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $register$
declare
  v_id uuid;
begin
  if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role)) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null
     or p_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay')
     or nullif(btrim(p_provider_beneficiary_ref), '') is null
     or nullif(btrim(p_account_holder), '') is null
     or nullif(btrim(p_masked_account_label), '') is null then
    raise exception 'VALIDATED_PROVIDER_BENEFICIARY_DATA_REQUIRED' using errcode = '22023';
  end if;

  insert into public.marketplace_payout_beneficiaries(
    user_id, channel, provider_beneficiary_ref, account_holder, masked_account_label
  )
  values(
    p_user_id, p_channel, btrim(p_provider_beneficiary_ref),
    btrim(p_account_holder), btrim(p_masked_account_label)
  )
  returning id into v_id;

  insert into public.marketplace_payout_audit(beneficiary_id, actor_id, action, metadata)
  values(v_id, auth.uid(), 'beneficiary.registered', jsonb_build_object('channel', p_channel));

  return v_id;
end;
$register$;

create or replace function public.admin_review_marketplace_payout_beneficiary(
  p_beneficiary_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_beneficiary public.marketplace_payout_beneficiaries%rowtype;
begin
  if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role)) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('verified','rejected','disabled') then
    raise exception 'INVALID_BENEFICIARY_DECISION' using errcode = '22023';
  end if;

  select * into v_beneficiary
  from public.marketplace_payout_beneficiaries
  where id = p_beneficiary_id
  for update;
  if not found then
    raise exception 'PAYOUT_BENEFICIARY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_decision = 'verified' and exists (
    select 1 from public.marketplace_payout_beneficiaries b
    where b.user_id = v_beneficiary.user_id
      and b.status = 'verified'
      and b.id <> v_beneficiary.id
  ) then
    raise exception 'USER_ALREADY_HAS_VERIFIED_PAYOUT_BENEFICIARY' using errcode = '23505';
  end if;

  update public.marketplace_payout_beneficiaries
  set status = p_decision,
      verified_at = case when p_decision = 'verified' then now() else null end,
      verified_by = case when p_decision = 'verified' then auth.uid() else null end,
      rejection_reason = case when p_decision = 'rejected' then nullif(btrim(p_reason), '') else null end,
      updated_at = now()
  where id = p_beneficiary_id;

  if p_decision = 'verified' then
    update public.marketplace_payouts p
    set beneficiary_id = v_beneficiary.id,
        status = 'awaiting_manual_payout',
        updated_at = now()
    where p.recipient_user_id = v_beneficiary.user_id
      and p.status = 'awaiting_beneficiary_verification';

    update public.marketplace_payouts p
    set status = 'awaiting_manual_payout',
        updated_at = now()
    where p.beneficiary_id = p_beneficiary_id
      and p.status = 'blocked';
  elsif p_decision in ('rejected','disabled') then
    update public.marketplace_payouts p
    set status = 'blocked',
        updated_at = now()
    where p.beneficiary_id = p_beneficiary_id
      and p.status in ('awaiting_manual_payout','processing','failed');
  end if;

  insert into public.marketplace_payout_audit(beneficiary_id, actor_id, action, metadata)
  values (
    p_beneficiary_id, auth.uid(), 'beneficiary.' || p_decision,
    jsonb_build_object('reason', nullif(btrim(p_reason), ''))
  );
end;
$$;

create or replace function public.admin_transition_marketplace_payout(
  p_payout_id uuid,
  p_action text,
  p_payout_reference text default null,
  p_proof_url text default null,
  p_failure_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.marketplace_payouts%rowtype;
  v_next_status text;
begin
  if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(), 'admin'::public.app_role)) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_payout
  from public.marketplace_payouts
  where id = p_payout_id
  for update;
  if not found then
    raise exception 'PAYOUT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_action is null then
    raise exception 'INVALID_PAYOUT_ACTION' using errcode = '22023';
  elsif p_action = 'processing' then
    if v_payout.status <> 'awaiting_manual_payout' or v_payout.beneficiary_id is null
       or not exists (select 1 from public.marketplace_payout_beneficiaries b where b.id = v_payout.beneficiary_id and b.user_id = v_payout.recipient_user_id and b.status = 'verified') then
      raise exception 'VERIFIED_BENEFICIARY_REQUIRED_BEFORE_PROCESSING' using errcode = '23514';
    end if;
    v_next_status := 'processing';
  elsif p_action = 'paid' then
    if v_payout.status <> 'processing' then
      raise exception 'PAYOUT_MUST_BE_PROCESSING_BEFORE_PAID' using errcode = '23514';
    end if;
    if nullif(btrim(p_payout_reference), '') is null
       or nullif(btrim(p_proof_url), '') is null then
      raise exception 'TRANSFER_REFERENCE_AND_PROOF_REQUIRED' using errcode = '23514';
    end if;
    if btrim(p_proof_url) not like p_payout_id::text || '/%' then
      raise exception 'PAYOUT_PROOF_MUST_USE_PRIVATE_PAYOUT_FOLDER' using errcode = '23514';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'marketplace-payout-proofs'
        and o.name = btrim(p_proof_url)
    ) then
      raise exception 'PAYOUT_PROOF_FILE_NOT_FOUND_IN_PRIVATE_STORAGE' using errcode = '23514';
    end if;
    v_next_status := 'paid';
  elsif p_action = 'failed' then
    if v_payout.status not in ('processing','awaiting_manual_payout') then
      raise exception 'INVALID_PAYOUT_FAILURE_TRANSITION' using errcode = '23514';
    end if;
    if nullif(btrim(p_failure_reason), '') is null then
      raise exception 'FAILURE_REASON_REQUIRED' using errcode = '23514';
    end if;
    v_next_status := 'failed';
  elsif p_action = 'retry' then
    if v_payout.status <> 'failed' or v_payout.beneficiary_id is null
       or not exists (select 1 from public.marketplace_payout_beneficiaries b where b.id = v_payout.beneficiary_id and b.user_id = v_payout.recipient_user_id and b.status = 'verified') then
      raise exception 'FAILED_PAYOUT_WITH_VERIFIED_BENEFICIARY_REQUIRED' using errcode = '23514';
    end if;
    v_next_status := 'awaiting_manual_payout';
  elsif p_action = 'blocked' then
    if v_payout.status in ('paid','cancelled') then
      raise exception 'TERMINAL_PAYOUT_CANNOT_BE_BLOCKED' using errcode = '23514';
    end if;
    v_next_status := 'blocked';
  elsif p_action = 'unblock' then
    if v_payout.status <> 'blocked' or v_payout.beneficiary_id is null
       or not exists (select 1 from public.marketplace_payout_beneficiaries b where b.id = v_payout.beneficiary_id and b.user_id = v_payout.recipient_user_id and b.status = 'verified') then
      raise exception 'BLOCKED_PAYOUT_WITH_VERIFIED_BENEFICIARY_REQUIRED' using errcode = '23514';
    end if;
    v_next_status := 'awaiting_manual_payout';
  elsif p_action = 'cancelled' then
    if v_payout.status = 'paid' then
      raise exception 'PAID_PAYOUT_CANNOT_BE_CANCELLED' using errcode = '23514';
    end if;
    v_next_status := 'cancelled';
  else
    raise exception 'INVALID_PAYOUT_ACTION' using errcode = '22023';
  end if;

  update public.marketplace_payouts
  set status = v_next_status,
      payout_reference = case when v_next_status = 'paid' then btrim(p_payout_reference) else payout_reference end,
      proof_url = case when v_next_status = 'paid' then btrim(p_proof_url) else proof_url end,
      paid_at = case when v_next_status = 'paid' then now() else paid_at end,
      paid_by = case when v_next_status = 'paid' then auth.uid() else paid_by end,
      failure_reason = case when v_next_status = 'failed' then btrim(p_failure_reason) else null end,
      updated_at = now()
  where id = p_payout_id;

  insert into public.marketplace_payout_audit(payout_id, actor_id, action, metadata)
  values (
    p_payout_id, auth.uid(), 'payout.' || v_next_status,
    jsonb_build_object(
      'previous_status', v_payout.status,
      'payout_reference', case when v_next_status = 'paid' then btrim(p_payout_reference) else null end,
      'proof_url_present', v_next_status = 'paid',
      'failure_reason', case when v_next_status = 'failed' then btrim(p_failure_reason) else null end
    )
  );
end;
$$;

revoke all on function public.admin_register_marketplace_payout_beneficiary(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_review_marketplace_payout_beneficiary(uuid,text,text) from public, anon, authenticated;
revoke all on function public.admin_transition_marketplace_payout(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_register_marketplace_payout_beneficiary(uuid,text,text,text,text) to authenticated;
grant execute on function public.admin_review_marketplace_payout_beneficiary(uuid,text,text) to authenticated;
grant execute on function public.admin_transition_marketplace_payout(uuid,text,text,text,text) to authenticated;

commit;
