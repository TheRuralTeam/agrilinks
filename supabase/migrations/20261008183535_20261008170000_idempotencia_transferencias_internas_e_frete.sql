-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008183535; original ledger name: 20261008170000_idempotencia_transferencias_internas_e_frete.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

begin;

alter table public.transactions
  add column if not exists operation_id uuid;

create unique index if not exists ux_transactions_operation_id
  on public.transactions(operation_id)
  where operation_id is not null;

create index if not exists idx_transactions_related_user_created_at
  on public.transactions(related_user_id, created_at desc);

create or replace function public.process_internal_transfer(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_description text,
  p_operation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path='public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_from_wallet public.wallets%rowtype;
  v_to_wallet public.wallets%rowtype;
  v_debit_id uuid;
  v_credit_id uuid;
  v_existing uuid;
begin
  if v_caller is null then
    raise exception 'Não autorizado';
  end if;

  if v_caller <> p_from_user_id then
    raise exception 'A conta de origem deve pertencer ao utilizador autenticado';
  end if;

  if p_to_user_id is null or p_from_user_id = p_to_user_id then
    raise exception 'Destinatário inválido';
  end if;

  if p_operation_id is null then
    raise exception 'A chave de idempotência é obrigatória';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'O valor da transferência deve ser maior que zero';
  end if;

  if p_amount > 1000000000 then
    raise exception 'Valor da transferência excede o limite permitido';
  end if;

  select t.id into v_existing
  from public.transactions t
  where t.operation_id = p_operation_id
  order by t.created_at asc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_from_wallet
  from public.wallets
  where user_id = p_from_user_id
  for update;

  if not found then
    raise exception 'Carteira de origem não encontrada';
  end if;

  select * into v_to_wallet
  from public.wallets
  where user_id = p_to_user_id
  for update;

  if not found then
    raise exception 'Carteira de destino não encontrada';
  end if;

  if v_from_wallet.available_balance < p_amount then
    raise exception 'Saldo insuficiente';
  end if;

  update public.wallets
  set available_balance = available_balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at = now()
  where id = v_from_wallet.id;

  update public.wallets
  set available_balance = available_balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = now()
  where id = v_to_wallet.id;

  insert into public.transactions(
    wallet_id,type,status,amount,description,reference_id,related_user_id,metadata,created_at,completed_at,operation_id
  ) values (
    v_from_wallet.id,'transfer','completed',p_amount,
    coalesce(nullif(trim(p_description),''),'Transferência interna'),
    null,p_to_user_id,
    jsonb_build_object('operation_id',p_operation_id,'direction','debit','from_user_id',p_from_user_id,'to_user_id',p_to_user_id),
    now(),now(),p_operation_id
  )
  returning id into v_debit_id;

  insert into public.transactions(
    wallet_id,type,status,amount,description,reference_id,related_user_id,metadata,created_at,completed_at,operation_id
  ) values (
    v_to_wallet.id,'transfer','completed',p_amount,
    coalesce(nullif(trim(p_description),''),'Transferência interna'),
    null,p_from_user_id,
    jsonb_build_object('operation_id',p_operation_id,'direction','credit','from_user_id',p_from_user_id,'to_user_id',p_to_user_id),
    now(),now(),p_operation_id
  )
  returning id into v_credit_id;

  return v_debit_id;

exception
  when unique_violation then
    select t.id into v_existing
    from public.transactions t
    where t.operation_id = p_operation_id
    order by t.created_at asc
    limit 1;

    if v_existing is not null then
      return v_existing;
    end if;
    raise;
end;
$function$;

revoke execute on function public.process_internal_transfer(uuid,uuid,numeric,text) from anon, authenticated, public;
grant execute on function public.process_internal_transfer(uuid,uuid,numeric,text) to service_role;
revoke execute on function public.process_internal_transfer(uuid,uuid,numeric,text,uuid) from anon, public;
grant execute on function public.process_internal_transfer(uuid,uuid,numeric,text,uuid) to authenticated, service_role;

drop trigger if exists protect_freight_load_critical_fields on public.freight_loads;
drop function if exists public.protect_freight_load_critical_fields();

commit;
