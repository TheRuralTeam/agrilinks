CREATE OR REPLACE FUNCTION public.sync_user_email_verified(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email_verified = true,
      updated_at = NOW()
  WHERE id = p_user_id
    AND (email_verified IS DISTINCT FROM true OR updated_at IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_email_verified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_email_verified(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type text;
  v_full_name text;
  v_referred_by_agent_id uuid;
  v_load_capacity_kg numeric;
BEGIN
  v_user_type := NULLIF(NEW.raw_user_meta_data->>'user_type', '');
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );

  BEGIN
    v_referred_by_agent_id := NULLIF(NEW.raw_user_meta_data->>'referred_by_agent_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_referred_by_agent_id := NULL;
  END;

  BEGIN
    v_load_capacity_kg := NULLIF(NEW.raw_user_meta_data->>'load_capacity_kg', '')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    v_load_capacity_kg := NULL;
  END;

  INSERT INTO public.users (
    id,
    email,
    phone,
    full_name,
    identity_document,
    user_type,
    province_id,
    municipality_id,
    referred_by_agent_id,
    email_verified,
    phone_verified,
    avatar_url,
    load_capacity_kg,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_full_name,
    NULLIF(NEW.raw_user_meta_data->>'identity_document', ''),
    CASE
      WHEN v_user_type IS NOT NULL AND v_user_type <> '' THEN v_user_type::user_type_enum
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'province_id', ''),
    NULLIF(NEW.raw_user_meta_data->>'municipality_id', ''),
    v_referred_by_agent_id,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    false,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), NULLIF(NEW.raw_user_meta_data->>'picture', '')),
    v_load_capacity_kg,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    full_name = EXCLUDED.full_name,
    identity_document = EXCLUDED.identity_document,
    user_type = EXCLUDED.user_type,
    province_id = EXCLUDED.province_id,
    municipality_id = EXCLUDED.municipality_id,
    referred_by_agent_id = EXCLUDED.referred_by_agent_id,
    email_verified = COALESCE(public.users.email_verified, EXCLUDED.email_verified) OR EXCLUDED.email_verified,
    avatar_url = EXCLUDED.avatar_url,
    load_capacity_kg = EXCLUDED.load_capacity_kg,
    updated_at = NOW();

  INSERT INTO public.audit_logs (
    event_type,
    user_email,
    user_id,
    user_type,
    details,
    action
  )
  VALUES (
    'USER_CREATED',
    NEW.email,
    NEW.id,
    v_user_type,
    jsonb_build_object(
      'signup_method', NEW.raw_app_meta_data->>'provider',
      'created_at', NEW.created_at,
      'oauth_email_verified', NEW.email_confirmed_at IS NOT NULL
    ),
    'USER_CREATED'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_email ON auth.users;
CREATE TRIGGER on_auth_user_updated_email
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at))
EXECUTE FUNCTION public.handle_new_user();
