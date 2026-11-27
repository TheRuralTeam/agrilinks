-- Static contract checks for freight-load row and column access.
begin;

do $$
declare
  v_policy text;
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'freight_loads'
      and c.relrowsecurity
  ) then
    raise exception 'freight_loads must keep row-level security enabled';
  end if;

  if has_table_privilege('anon', 'public.freight_loads', 'SELECT') then
    raise exception 'anonymous users must not select freight loads';
  end if;

  if has_table_privilege('authenticated', 'public.freight_loads', 'SELECT') then
    raise exception 'authenticated users must not have table-wide SELECT';
  end if;

  if not has_column_privilege('authenticated', 'public.freight_loads', 'id', 'SELECT') then
    raise exception 'authenticated users must retain access to safe freight columns';
  end if;

  if not has_column_privilege('authenticated', 'public.freight_loads', 'buyer_quote_approved', 'SELECT')
     or not has_column_privilege('authenticated', 'public.freight_loads', 'supplier_quote_approved', 'SELECT') then
    raise exception 'authorized users must retain quote approval metadata';
  end if;

  if has_column_privilege('authenticated', 'public.freight_loads', 'qr_token', 'SELECT') then
    raise exception 'QR token must not be directly selectable by authenticated users';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'freight_loads'
      and policyname = 'Authenticated can view freight loads'
  ) then
    raise exception 'the unrestricted freight-load read policy must be removed';
  end if;

  select qual into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'freight_loads'
    and policyname = 'Freight participants can read their loads';

  if v_policy is null
    or position('available' in v_policy) = 0
    or position('open' in v_policy) = 0
    or position('agendado' in v_policy) = 0
    or position('created_by' in v_policy) = 0
    or position('driver_id' in v_policy) = 0
    or position('supplier_id' in v_policy) = 0
    or position('buyer_id' in v_policy) = 0 then
    raise exception 'freight discovery and participant access rules are incomplete';
  end if;

  if has_function_privilege('anon', 'public.get_freight_load_qr_details(text)', 'EXECUTE') then
    raise exception 'anonymous users must not execute the QR details RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.get_freight_load_qr_details(text)', 'EXECUTE') then
    raise exception 'authenticated QR workflow must remain available through its guarded RPC';
  end if;
end;
$$;

rollback;
