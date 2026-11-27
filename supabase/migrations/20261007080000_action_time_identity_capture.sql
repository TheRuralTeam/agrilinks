-- Identity is collected at the moment a regulated marketplace action is performed.
-- It is never required just to create/login to an AgriLink account.

CREATE OR REPLACE FUNCTION public.set_my_identity_document(p_identity_document text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_identity text := upper(regexp_replace(coalesce(p_identity_document, ''), '\s+', ' ', 'g'));
  v_user public.users;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;

  v_identity := NULLIF(btrim(v_identity), '');

  IF v_identity IS NULL THEN
    RAISE EXCEPTION 'IDENTITY_REQUIRED' USING ERRCODE='22023';
  END IF;

  IF length(v_identity) < 6
     OR length(v_identity) > 32
     OR v_identity !~ '^[A-Z0-9./ -]+$' THEN
    RAISE EXCEPTION 'IDENTITY_INVALID: informe um número de BI ou NIF válido'
      USING ERRCODE='22023';
  END IF;

  UPDATE public.users
  SET identity_document = v_identity,
      updated_at = now()
  WHERE id = v_uid
  RETURNING * INTO v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE='P0002';
  END IF;

  INSERT INTO public.audit_logs(event_type, action, user_id, details)
  VALUES (
    'IDENTITY_DOCUMENT_ADDED',
    'USER_IDENTITY_DOCUMENT_ADDED',
    v_uid,
    jsonb_build_object('identity_document_length', length(v_identity))
  );

  RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_identity_document(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_identity_document(text) TO authenticated;
