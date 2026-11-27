-- QA/security: limitar dados pessoais e referências financeiras nos comprovativos
-- vistos por motoristas que não sejam compradores, vendedores ou administradores.
-- A função original mantém as suas verificações de acesso e passa a ser interna.

alter function public.get_marketplace_transaction_receipt(uuid)
  rename to get_marketplace_transaction_receipt_internal;

revoke all on function public.get_marketplace_transaction_receipt_internal(uuid)
  from public, anon, authenticated;

create or replace function public.get_marketplace_transaction_receipt(p_pre_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_receipt jsonb;
  v_buyer_id uuid;
  v_seller_id uuid;
  v_is_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'TRANSACTION_RECEIPT_FORBIDDEN';
  end if;

  v_receipt := public.get_marketplace_transaction_receipt_internal(p_pre_order_id);
  v_buyer_id := nullif(v_receipt #>> '{buyer,id}', '')::uuid;
  v_seller_id := nullif(v_receipt #>> '{seller,id}', '')::uuid;
  v_is_admin := public.is_root_admin(v_uid)
    or public.has_role(v_uid, 'admin'::public.app_role);

  if v_uid is distinct from v_buyer_id
     and v_uid is distinct from v_seller_id
     and not v_is_admin then
    v_receipt := jsonb_set(v_receipt, '{buyer,email}', 'null'::jsonb, true);
    v_receipt := jsonb_set(v_receipt, '{seller,email}', 'null'::jsonb, true);
    if jsonb_typeof(v_receipt->'payment') = 'object' then
      v_receipt := jsonb_set(v_receipt, '{payment,provider_reference}', 'null'::jsonb, true);
    end if;
    if jsonb_typeof(v_receipt->'p2p') = 'object' then
      v_receipt := jsonb_set(v_receipt, '{p2p,transfer_reference}', 'null'::jsonb, true);
    end if;
  end if;

  return v_receipt;
end;
$$;

revoke all on function public.get_marketplace_transaction_receipt(uuid)
  from public, anon;
grant execute on function public.get_marketplace_transaction_receipt(uuid)
  to authenticated;