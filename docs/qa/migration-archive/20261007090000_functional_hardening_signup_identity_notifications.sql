-- AgriLink functional hardening.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text := COALESCE(NULLIF(NEW.raw_app_meta_data->>'provider', ''), 'email');
  v_full_name text := COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, 'utilizador'), '@', 1));
  v_phone text := NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone), '');
BEGIN
  INSERT INTO public.users (id,email,phone,full_name,email_verified,phone_verified,avatar_url,auth_provider,updated_at)
  VALUES (
    NEW.id, NEW.email, v_phone, v_full_name, NEW.email_confirmed_at IS NOT NULL, false,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'), ''),
    v_provider, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email=EXCLUDED.email,
    phone=COALESCE(EXCLUDED.phone,public.users.phone),
    full_name=COALESCE(NULLIF(EXCLUDED.full_name,''),public.users.full_name),
    email_verified=public.users.email_verified OR EXCLUDED.email_verified,
    avatar_url=COALESCE(public.users.avatar_url,EXCLUDED.avatar_url),
    auth_provider=COALESCE(public.users.auth_provider,EXCLUDED.auth_provider),
    updated_at=now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_type(
  p_user_id uuid,
  p_user_type public.user_type_enum
)
RETURNS TABLE(id uuid,full_name text,user_type public.user_type_enum,agent_code text,updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.user_type_enum;
  v_agent_code text;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.is_root_admin(v_actor) OR public.is_super_root(v_actor) OR
    public.has_admin_permission(v_actor,'manage_users'::public.admin_permission)
  ) THEN
    RAISE EXCEPTION 'Permission denied to change user type' USING ERRCODE='42501';
  END IF;
  IF p_user_id IS NULL OR p_user_type IS NULL THEN
    RAISE EXCEPTION 'User and user type are required' USING ERRCODE='22023';
  END IF;

  SELECT u.user_type INTO v_old FROM public.users u WHERE u.id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE='P0002'; END IF;

  IF v_old IS DISTINCT FROM p_user_type THEN
    IF p_user_type='agente' AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id=p_user_id AND ur.role IN ('admin'::public.app_role,'support_agent'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'Administrative accounts cannot be converted to an operational agent' USING ERRCODE='42501';
    END IF;

    IF p_user_type='agente' THEN
      SELECT NULLIF(btrim(u.agent_code),'') INTO v_agent_code FROM public.users u WHERE u.id=p_user_id;
      IF v_agent_code IS NULL THEN v_agent_code := public.generate_agent_code(); END IF;
    END IF;

    UPDATE public.users
    SET user_type=p_user_type,
        agent_code=CASE WHEN p_user_type='agente' THEN v_agent_code ELSE agent_code END,
        updated_at=now()
    WHERE id=p_user_id;

    INSERT INTO public.audit_logs(event_type,action,user_id,details)
    VALUES('USER_TYPE_CHANGED','ADMIN_USER_TYPE_CHANGED',v_actor,
      jsonb_build_object('target_user_id',p_user_id,'previous_user_type',v_old,'new_user_type',p_user_type));
  END IF;

  RETURN QUERY SELECT u.id,u.full_name,u.user_type,u.agent_code,u.updated_at
  FROM public.users u WHERE u.id=p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_type(uuid,public.user_type_enum) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_type(uuid,public.user_type_enum) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_identity_for_market_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid:=auth.uid(); v_identity text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF public.is_root_admin(v_uid) OR public.is_super_root(v_uid) THEN RETURN NEW; END IF;
  SELECT NULLIF(btrim(identity_document),'') INTO v_identity FROM public.users WHERE id=v_uid;
  IF v_identity IS NULL THEN
    RAISE EXCEPTION 'IDENTITY_REQUIRED: informe o número do Bilhete de Identidade ou NIF antes de executar esta operação'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_require_identity_for_product ON public.products;
CREATE TRIGGER trg_require_identity_for_product BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_for_market_action();
DROP TRIGGER IF EXISTS trg_require_identity_for_pre_order ON public.pre_orders;
CREATE TRIGGER trg_require_identity_for_pre_order BEFORE INSERT ON public.pre_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_for_market_action();
DROP TRIGGER IF EXISTS trg_require_identity_for_ficha ON public.fichas_recebimento;
CREATE TRIGGER trg_require_identity_for_ficha BEFORE INSERT ON public.fichas_recebimento
FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_for_market_action();

CREATE OR REPLACE FUNCTION public.enqueue_pre_order_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_recipient_id uuid;
  v_email text;
  v_name text;
  v_product_name text;
  v_pickup text;
  v_supplier_name text;
  v_total numeric;
  v_subject text;
  v_message text;
BEGIN
  IF TG_OP='INSERT' THEN v_event:='pending';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN v_event:=NEW.status;
  ELSE RETURN NEW;
  END IF;

  SELECT p.product_type, concat_ws(', ',p.municipality_id,p.province_id), u.full_name
  INTO v_product_name,v_pickup,v_supplier_name
  FROM public.products p LEFT JOIN public.users u ON u.id=p.user_id
  WHERE p.id=NEW.product_id;

  IF v_event='pending' THEN
    SELECT p.user_id INTO v_recipient_id FROM public.products p WHERE p.id=NEW.product_id;
    v_subject:='Nova pré-compra na AgriLink';
    v_message:=format('Recebeu uma nova pré-compra de %s kg para o produto %s.',NEW.quantity,COALESCE(v_product_name,'o seu produto'));
  ELSIF v_event='accepted' THEN
    v_recipient_id:=NEW.user_id;
    v_total:=COALESCE(NEW.quantity::numeric*NEW.unit_price,0);
    v_subject:='A sua pré-compra foi aceite — AgriLink';
    v_message:=format('A sua pré-compra de %s kg de %s foi aceite. O stock solicitado está disponível.',NEW.quantity,COALESCE(v_product_name,'produto'));
  ELSIF v_event IN ('rejected','completed') THEN
    v_recipient_id:=NEW.user_id;
    v_subject:=CASE WHEN v_event='rejected' THEN 'Pré-compra não aceite — AgriLink' ELSE 'Pré-compra concluída — AgriLink' END;
    v_message:=format('A sua pré-compra de %s para %s foi marcada como %s.',NEW.quantity,COALESCE(v_product_name,'o produto'),v_event);
  ELSE RETURN NEW;
  END IF;

  SELECT email,full_name INTO v_email,v_name FROM public.users WHERE id=v_recipient_id;
  IF NULLIF(btrim(v_email),'') IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.email_outbox(dedupe_key,recipient,subject,template,priority,scheduled_at,payload)
  VALUES(
    'pre-order:'||NEW.id::text||':'||v_event,
    lower(btrim(v_email)),
    v_subject,
    CASE WHEN v_event='accepted' THEN 'pre-order-accepted' ELSE 'business-event' END,
    CASE WHEN v_event='accepted' THEN 100 ELSE 70 END,
    now(),
    CASE WHEN v_event='accepted' THEN
      jsonb_build_object(
        'full_name',v_name,'event',v_event,'pre_order_id',NEW.id,'product_id',NEW.product_id,
        'product_name',v_product_name,'quantity',NEW.quantity,'unit_price',NEW.unit_price,
        'total_price',COALESCE(NEW.quantity::numeric*NEW.unit_price,0),
        'pickup_location',v_pickup,'receiving_point',NULLIF(btrim(NEW.location),''),
        'supplier_name',v_supplier_name
      )
    ELSE
      jsonb_build_object('full_name',v_name,'title',v_subject,'message',v_message,'event',v_event,'pre_order_id',NEW.id,'product_id',NEW.product_id)
    END
  ) ON CONFLICT(dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_pre_order_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_product text; v_supplier text; v_total numeric; v_pickup text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status='accepted' THEN
    SELECT p.product_type,u.full_name,concat_ws(', ',p.municipality_id,p.province_id)
    INTO v_product,v_supplier,v_pickup
    FROM public.products p LEFT JOIN public.users u ON u.id=p.user_id
    WHERE p.id=NEW.product_id;
    v_total:=COALESCE(NEW.quantity::numeric*NEW.unit_price,0);
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id=NEW.user_id AND n.type='pre_order_accepted'
        AND n.metadata->>'pre_order_id'=NEW.id::text
    ) THEN
      PERFORM public.create_notification(
        NEW.user_id,'pre_order_accepted','Pré-compra aceite',
        format('A sua pré-compra de %s kg de %s foi aceite. Total: %s Kz.',NEW.quantity,COALESCE(v_product,'produto'),to_char(v_total,'FM999G999G999G990D00')),
        jsonb_build_object(
          'pre_order_id',NEW.id,'product_id',NEW.product_id,'quantity',NEW.quantity,
          'unit_price',NEW.unit_price,'total_price',v_total,'pickup_location',v_pickup,
          'receiving_point',NEW.location,'supplier_name',v_supplier
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_pre_order_accepted ON public.pre_orders;
CREATE TRIGGER notify_pre_order_accepted AFTER UPDATE OF status ON public.pre_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_pre_order_acceptance();
REVOKE ALL ON FUNCTION public.enforce_identity_for_market_action() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_identity_for_market_action() TO authenticated;
REVOKE ALL ON FUNCTION public.notify_pre_order_acceptance() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notify_pre_order_acceptance() TO authenticated;
