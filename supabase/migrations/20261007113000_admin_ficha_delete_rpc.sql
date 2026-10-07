-- Administrative deletion for receipt/technical sheets is performed through
-- auditable SECURITY DEFINER RPCs because the base table DELETE policy is owner-only.

CREATE OR REPLACE FUNCTION public.admin_delete_ficha_recebimento(p_ficha_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_owner uuid;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.is_root_admin(v_actor) OR public.is_super_root(v_actor) OR
    public.has_admin_permission(v_actor,'manage_products'::public.admin_permission)
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.fichas_recebimento
  WHERE id=p_ficha_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  DELETE FROM public.fichas_recebimento WHERE id=p_ficha_id;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES(
    'FICHA_RECEBIMENTO_DELETED','ADMIN_FICHA_RECEBIMENTO_DELETED',v_actor,
    jsonb_build_object('ficha_id',p_ficha_id,'owner_id',v_owner)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_delete_fichas_recebimento(p_ficha_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_count integer:=0;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.is_root_admin(v_actor) OR public.is_super_root(v_actor) OR
    public.has_admin_permission(v_actor,'manage_products'::public.admin_permission)
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';
  END IF;

  DELETE FROM public.fichas_recebimento WHERE id=ANY(p_ficha_ids);
  GET DIAGNOSTICS v_count=ROW_COUNT;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES(
    'FICHA_RECEBIMENTO_BULK_DELETED','ADMIN_FICHA_RECEBIMENTO_BULK_DELETED',v_actor,
    jsonb_build_object('ficha_ids',p_ficha_ids,'count',v_count)
  );
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_ficha_recebimento(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_ficha_recebimento(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_bulk_delete_fichas_recebimento(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_delete_fichas_recebimento(uuid[]) TO authenticated;
