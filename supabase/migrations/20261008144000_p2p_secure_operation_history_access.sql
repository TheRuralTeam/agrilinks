create or replace function public.get_my_p2p_operations()
returns table (
  id uuid,
  buyer_id uuid,
  pre_order_id uuid,
  beneficiary_id uuid,
  beneficiary_account_id uuid,
  amount numeric,
  currency char(3),
  payment_channel text,
  status text,
  transfer_reference text,
  expires_at timestamptz,
  created_at timestamptz,
  actor_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.buyer_id,
    o.pre_order_id,
    o.beneficiary_id,
    o.beneficiary_account_id,
    o.amount,
    o.currency,
    o.payment_channel,
    o.status,
    o.transfer_reference,
    o.expires_at,
    o.created_at,
    case
      when o.buyer_id = (select auth.uid()) then 'buyer'
      when exists (
        select 1 from public.p2p_beneficiaries b
        where b.id = o.beneficiary_id and b.user_id = (select auth.uid())
      ) then 'p2p_beneficiary'
      when exists (
        select 1
        from public.pre_orders po
        join public.products p on p.id = po.product_id
        where po.id = o.pre_order_id and p.user_id = (select auth.uid())
      ) then 'seller'
      else 'admin'
    end
  from public.p2p_orders o
  where public.p2p_actor_can_view_order(o.id, (select auth.uid()))
  order by o.created_at desc
  limit 100;
$$;

revoke all on function public.get_my_p2p_operations() from public, anon;
grant execute on function public.get_my_p2p_operations() to authenticated;

drop policy if exists "P2P orders view participants seller or admin" on public.p2p_orders;
create policy "P2P orders view buyer beneficiary or admin"
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
  or public.is_root_admin((select auth.uid()))
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
);