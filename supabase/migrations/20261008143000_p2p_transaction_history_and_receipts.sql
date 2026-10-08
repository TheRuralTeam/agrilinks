-- Histórico completo e comprovante verificável das operações P2P.
-- Buyer, beneficiário P2P, vendedor e administração podem consultar apenas operações às quais têm vínculo.

create or replace function public.p2p_actor_can_view_order(p_order_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.p2p_orders o
    left join public.pre_orders po on po.id = o.pre_order_id
    left join public.products p on p.id = po.product_id
    where o.id = p_order_id
      and (
        o.buyer_id = p_user_id
        or exists (
          select 1 from public.p2p_beneficiaries b
          where b.id = o.beneficiary_id and b.user_id = p_user_id
        )
        or p.user_id = p_user_id
        or public.is_root_admin(p_user_id)
        or public.has_role(p_user_id, 'admin'::public.app_role)
      )
  );
$$;

revoke all on function public.p2p_actor_can_view_order(uuid, uuid) from public, anon;
grant execute on function public.p2p_actor_can_view_order(uuid, uuid) to authenticated;

drop policy if exists "P2P orders view participants or admin" on public.p2p_orders;
create policy "P2P orders view participants seller or admin"
on public.p2p_orders
for select
to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.p2p_beneficiaries b
    where b.id = p2p_orders.beneficiary_id
      and b.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.pre_orders po
    join public.products p on p.id = po.product_id
    where po.id = p2p_orders.pre_order_id
      and p.user_id = (select auth.uid())
  )
  or public.is_root_admin((select auth.uid()))
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
);

drop policy if exists "P2P events view participant or admin" on public.p2p_transaction_events;
create policy "P2P events view buyer beneficiary seller or admin"
on public.p2p_transaction_events
for select
to authenticated
using (
  exists (
    select 1
    from public.p2p_orders o
    left join public.pre_orders po on po.id = o.pre_order_id
    left join public.products p on p.id = po.product_id
    where o.id = p2p_transaction_events.p2p_order_id
      and (
        o.buyer_id = (select auth.uid())
        or exists (
          select 1 from public.p2p_beneficiaries b
          where b.id = o.beneficiary_id
            and b.user_id = (select auth.uid())
        )
        or p.user_id = (select auth.uid())
        or public.is_root_admin((select auth.uid()))
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
      )
  )
);

create or replace function public.get_p2p_transaction_history(p_p2p_order_id uuid)
returns table (
  event_id uuid,
  event_type text,
  from_status text,
  to_status text,
  actor_id uuid,
  actor_role text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.p2p_actor_can_view_order(p_p2p_order_id, v_user_id) then
    raise exception 'P2P_HISTORY_FORBIDDEN';
  end if;

  return query
  select
    e.id,
    e.event_type,
    e.from_status,
    e.to_status,
    e.actor_id,
    case
      when e.actor_id = o.buyer_id then 'buyer'
      when b.user_id = e.actor_id then 'p2p_beneficiary'
      when p.user_id = e.actor_id then 'seller'
      when public.is_root_admin(e.actor_id) or public.has_role(e.actor_id, 'admin'::public.app_role) then 'admin'
      else 'system'
    end,
    e.metadata,
    e.created_at
  from public.p2p_transaction_events e
  join public.p2p_orders o on o.id = e.p2p_order_id
  left join public.p2p_beneficiaries b on b.id = o.beneficiary_id
  left join public.pre_orders po on po.id = o.pre_order_id
  left join public.products p on p.id = po.product_id
  where e.p2p_order_id = p_p2p_order_id
  order by e.created_at asc, e.id asc;
end;
$$;

revoke all on function public.get_p2p_transaction_history(uuid) from public, anon;
grant execute on function public.get_p2p_transaction_history(uuid) to authenticated;

create or replace function public.get_p2p_transaction_receipt(p_p2p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.p2p_orders%rowtype;
  v_pre public.pre_orders%rowtype;
  v_product public.products%rowtype;
  v_beneficiary public.p2p_beneficiaries%rowtype;
  v_ben_user public.users%rowtype;
  v_buyer public.users%rowtype;
  v_seller public.users%rowtype;
  v_receipt text;
  v_hash text;
  v_events jsonb;
begin
  if v_user_id is null or not public.p2p_actor_can_view_order(p_p2p_order_id, v_user_id) then
    raise exception 'P2P_RECEIPT_FORBIDDEN';
  end if;

  select * into v_order from public.p2p_orders where id = p_p2p_order_id;
  select * into v_pre from public.pre_orders where id = v_order.pre_order_id;
  select * into v_product from public.products where id = v_pre.product_id;
  select * into v_beneficiary from public.p2p_beneficiaries where id = v_order.beneficiary_id;
  select * into v_ben_user from public.users where id = v_beneficiary.user_id;
  select * into v_buyer from public.users where id = v_order.buyer_id;
  select * into v_seller from public.users where id = v_product.user_id;

  v_receipt := 'AGR-P2P-' || upper(substr(replace(v_order.id::text, '-', ''), 1, 12));

  select jsonb_agg(to_jsonb(h) order by h.created_at asc, h.event_id asc)
    into v_events
  from public.get_p2p_transaction_history(p_p2p_order_id) h;

  v_hash := encode(
    digest(
      concat_ws('|',
        v_receipt,
        v_order.id::text,
        coalesce(v_order.amount::text,''),
        coalesce(v_order.currency,''),
        coalesce(v_order.status,''),
        coalesce(v_order.transfer_reference,''),
        coalesce(v_order.completed_at::text,''),
        coalesce(v_pre.id::text,''),
        coalesce(v_product.id::text,''),
        coalesce(v_product.user_id::text,''),
        coalesce(v_order.beneficiary_id::text,'')
      ),
      'sha256'
    ),
    'hex'
  );

  return jsonb_build_object(
    'receipt_number', v_receipt,
    'validation_hash', upper(v_hash),
    'generated_at', now(),
    'operation', jsonb_build_object(
      'id', v_order.id,
      'status', v_order.status,
      'amount', v_order.amount,
      'currency', v_order.currency,
      'payment_channel', v_order.payment_channel,
      'transfer_reference', v_order.transfer_reference,
      'created_at', v_order.created_at,
      'accepted_at', v_order.accepted_at,
      'submitted_at', v_order.submitted_at,
      'completed_at', v_order.completed_at,
      'expires_at', v_order.expires_at
    ),
    'purchase', jsonb_build_object(
      'pre_order_id', v_pre.id,
      'product_id', v_product.id,
      'product_type', v_product.product_type,
      'quantity', v_pre.quantity,
      'unit_price', v_pre.unit_price,
      'total_price', v_pre.total_price,
      'location', v_pre.location
    ),
    'actors', jsonb_build_object(
      'buyer', jsonb_build_object('id', v_buyer.id, 'name', v_buyer.full_name, 'email', v_buyer.email),
      'seller', jsonb_build_object('id', v_seller.id, 'name', v_seller.full_name, 'email', v_seller.email),
      'p2p_beneficiary', jsonb_build_object('id', v_ben_user.id, 'name', v_ben_user.full_name, 'email', v_ben_user.email)
    ),
    'history', coalesce(v_events, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_p2p_transaction_receipt(uuid) from public, anon;
grant execute on function public.get_p2p_transaction_receipt(uuid) to authenticated;
