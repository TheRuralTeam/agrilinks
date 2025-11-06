-- Corrigir o erro de cast no trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    phone_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'identity_document',
    (NEW.raw_user_meta_data->>'user_type')::user_type_enum,  -- Cast explícito para enum
    NEW.raw_user_meta_data->>'province_id',
    NEW.raw_user_meta_data->>'municipality_id',
    (NEW.raw_user_meta_data->>'referred_by_agent_id')::uuid,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    false
  );
  
  RETURN NEW;
END;
$$;