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

  BEGIN
    INSERT INTO public.users (
      id, email, phone, full_name, identity_document,
      user_type, province_id, municipality_id,
      referred_by_agent_id, email_verified, phone_verified, avatar_url,
      load_capacity_kg, updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      v_full_name,
      NULLIF(NEW.raw_user_meta_data->>'identity_document', ''),
      CASE
        WHEN v_user_type IN ('agricultor', 'comprador', 'agente', 'motorista')
          THEN v_user_type::user_type_enum
        ELSE NULL
      END,
      NULLIF(NEW.raw_user_meta_data->>'province_id', ''),
      NULLIF(NEW.raw_user_meta_data->>'municipality_id', ''),
      v_referred_by_agent_id,
      NEW.email_confirmed_at IS NOT NULL,
      false,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), NULLIF(NEW.raw_user_meta_data->>'picture', '')),
      v_load_capacity_kg,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      email_verified = public.users.email_verified OR EXCLUDED.email_verified,
      updated_at = NOW();
  END;

  BEGIN
    INSERT INTO public.audit_logs (event_type, user_email, user_id, user_type, details, action)
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not write signup audit log for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;