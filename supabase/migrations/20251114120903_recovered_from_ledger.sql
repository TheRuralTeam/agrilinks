-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251114120903; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Corrigir funções SQL que ainda não têm search_path

CREATE OR REPLACE FUNCTION public.get_public_user_profile(p_user_id uuid)
RETURNS TABLE(id uuid, full_name text, avatar_url text, user_type user_type_enum, agent_code text, province_id text, municipality_id text, created_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
  SELECT 
    id,
    full_name,
    avatar_url,
    user_type,
    agent_code,
    province_id,
    municipality_id,
    created_at
  FROM public.users
  WHERE id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_contact(p_product_id uuid)
RETURNS TABLE(contact text, farmer_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be logged in to view contact information';
  END IF;

  RETURN QUERY
  SELECT 
    p.contact,
    p.farmer_name
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.status = 'active';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_agent_referral_stats(agent_user_id uuid)
RETURNS TABLE(total_referrals bigint, total_points bigint, recent_referrals jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_referrals,
    COALESCE(SUM(points), 0)::BIGINT as total_points,
    jsonb_agg(
      jsonb_build_object(
        'user_name', u.full_name,
        'user_type', u.user_type,
        'points', ar.points,
        'created_at', ar.created_at
      )
      ORDER BY ar.created_at DESC
    ) FILTER (WHERE ar.id IS NOT NULL) as recent_referrals
  FROM public.agent_referrals ar
  LEFT JOIN public.users u ON u.id = ar.referred_user_id
  WHERE ar.agent_id = agent_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_email_confirmation(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
  v_is_verified BOOLEAN;
BEGIN
  SELECT id, email_verified
  INTO v_user_id, v_is_verified
  FROM public.users
  WHERE email = user_email
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado');
  END IF;
  
  IF v_is_verified THEN
    RETURN jsonb_build_object('error', 'Email já verificado');
  END IF;
  
  INSERT INTO public.audit_logs (
    event_type,
    user_email,
    user_id,
    details,
    action
  )
  VALUES (
    'CONFIRMATION_EMAIL_REQUESTED',
    user_email,
    v_user_id,
    jsonb_build_object('requested_at', NOW()),
    'CONFIRMATION_EMAIL_REQUESTED'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitação registrada. Use o painel do Supabase para reenviar o email.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_agent_code(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_type = 'agente'
      AND agent_code = upper(p_code)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_agent_id_by_code(p_code text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
  SELECT id FROM public.users
  WHERE user_type = 'agente'
    AND agent_code = upper(p_code)
  LIMIT 1;
$function$;
