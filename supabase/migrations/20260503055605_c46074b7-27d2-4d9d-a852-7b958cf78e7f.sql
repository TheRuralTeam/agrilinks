CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_type text;
  v_full_name text;
BEGIN
  v_user_type := NEW.raw_user_meta_data->>'user_type';
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (
    id, email, phone, full_name, identity_document,
    user_type, province_id, municipality_id,
    referred_by_agent_id, email_verified, phone_verified, avatar_url
  )
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data->>'phone',
    v_full_name,
    NEW.raw_user_meta_data->>'identity_document',
    CASE WHEN v_user_type IS NOT NULL AND v_user_type <> ''
         THEN v_user_type::user_type_enum ELSE NULL END,
    NEW.raw_user_meta_data->>'province_id',
    NEW.raw_user_meta_data->>'municipality_id',
    (NEW.raw_user_meta_data->>'referred_by_agent_id')::uuid,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    false,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.audit_logs (event_type, user_email, user_id, user_type, details, action)
  VALUES (
    'USER_CREATED', NEW.email, NEW.id, v_user_type,
    jsonb_build_object(
      'signup_method', NEW.raw_app_meta_data->>'provider',
      'created_at', NEW.created_at
    ),
    'USER_CREATED'
  );

  RETURN NEW;
END;
$function$;

ALTER TABLE public.users ALTER COLUMN user_type DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN identity_document DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN province_id DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN municipality_id DROP NOT NULL;