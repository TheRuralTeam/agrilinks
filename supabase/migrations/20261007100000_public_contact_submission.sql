-- Allow the public contact form to create a support ticket without
-- granting direct INSERT access to support_messages.
CREATE OR REPLACE FUNCTION public.submit_public_contact(
  p_name text,
  p_email text,
  p_phone text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'CONTACT_NAME_INVALID' USING ERRCODE='22023';
  END IF;
  IF v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'CONTACT_EMAIL_INVALID' USING ERRCODE='22023';
  END IF;
  IF length(v_message) < 5 OR length(v_message) > 5000 THEN
    RAISE EXCEPTION 'CONTACT_MESSAGE_INVALID' USING ERRCODE='22023';
  END IF;
  IF v_phone IS NOT NULL AND length(v_phone) > 40 THEN
    RAISE EXCEPTION 'CONTACT_PHONE_INVALID' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.support_messages
    WHERE lower(email) = v_email
      AND created_at > now() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'CONTACT_RATE_LIMITED' USING ERRCODE='42900';
  END IF;

  INSERT INTO public.support_messages(user_id, name, email, phone, message, status)
  VALUES (v_user_id, v_name, v_email, v_phone, v_message, 'pendente')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_contact(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_contact(text,text,text,text) TO anon, authenticated;
