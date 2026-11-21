-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008183946; original ledger name: 20261008173500_reduzir_pii_perfil_publico.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

drop function if exists public.get_public_user_profile(uuid);
create function public.get_public_user_profile(p_user_id uuid)
returns table(id uuid,full_name text,avatar_url text,user_type user_type_enum,province_id text,municipality_id text,created_at timestamptz)
language sql stable security definer set search_path='public'
as $function$
 select id,full_name,avatar_url,user_type,province_id,municipality_id,created_at
 from public.users where id=p_user_id;
$function$;
