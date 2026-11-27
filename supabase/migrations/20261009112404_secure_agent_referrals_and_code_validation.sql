-- Protect agent referral attribution from client-supplied UUIDs and limit public code probing.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type text;
  v_full_name text;
  v_referred_by_agent_code text;
  v_referred_by_agent_id uuid;
  v_load_capacity_kg numeric;
BEGIN
  v_user_type := NULLIF(NEW.raw_user_meta_data->>'user_type', '');
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );

  -- Only accept a referral code; never trust a UUID supplied in user metadata.
  v_referred_by_agent_code := upper(NULLIF(btrim(NEW.raw_user_meta_data->>'referred_by_agent_code'), ''));
  IF v_referred_by_agent_code IS NOT NULL THEN
    SELECT id INTO v_referred_by_agent_id
    FROM public.users
    WHERE user_type = 'agente'
      AND agent_code = v_referred_by_agent_code
    LIMIT 1;
  END IF;

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

-- Rate-limit public validation attempts per request source.
CREATE OR REPLACE FUNCTION public.validate_agent_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_ip text;
  v_bucket text;
  v_now timestamptz := now();
  v_count integer;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9]{6}$' THEN
    RETURN false;
  END IF;

  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;

  v_ip := COALESCE(
    NULLIF(v_headers->>'cf-connecting-ip', ''),
    NULLIF(split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(v_headers->>'x-real-ip', '')
  );
  v_bucket := 'agent-code:ip:' || md5(COALESCE(NULLIF(btrim(v_ip), ''), 'unknown'));

  INSERT INTO public.api_rate_limits(bucket_key, window_started, request_count, updated_at)
  VALUES (v_bucket, v_now, 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE SET
    request_count = CASE
      WHEN public.api_rate_limits.window_started <= v_now - interval '15 minutes' THEN 1
      ELSE public.api_rate_limits.request_count + 1
    END,
    window_started = CASE
      WHEN public.api_rate_limits.window_started <= v_now - interval '15 minutes' THEN v_now
      ELSE public.api_rate_limits.window_started
    END,
    updated_at = v_now
  RETURNING request_count INTO v_count;

  IF v_count > 30 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE user_type = 'agente'
      AND agent_code = upper(p_code)
  );
END;
$$;

-- Referral IDs must be resolved inside the trusted signup trigger, not through public RPC.
REVOKE EXECUTE ON FUNCTION public.get_agent_id_by_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_agent_code(text) TO anon, authenticated;
