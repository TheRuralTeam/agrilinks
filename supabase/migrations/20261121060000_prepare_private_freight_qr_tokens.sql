BEGIN;

-- Create a private QR-token store while keeping the legacy column for a zero-downtime rollout.
CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.freight_load_qr_tokens (
  freight_load_id uuid PRIMARY KEY
    REFERENCES public.freight_loads(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT replace(pg_catalog.gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT freight_load_qr_tokens_token_key UNIQUE (token)
);

ALTER TABLE private.freight_load_qr_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.freight_load_qr_tokens FROM PUBLIC, anon, authenticated, service_role;

-- Preserve every existing token exactly so old QR documents remain valid during deployment.
INSERT INTO private.freight_load_qr_tokens (freight_load_id, token)
SELECT id, qr_token
FROM public.freight_loads
WHERE qr_token IS NOT NULL
ON CONFLICT (freight_load_id) DO NOTHING;

DO $$
DECLARE
  v_load_count integer;
  v_token_count integer;
BEGIN
  SELECT count(*)::integer INTO v_load_count FROM public.freight_loads;
  SELECT count(*)::integer INTO v_token_count FROM private.freight_load_qr_tokens;

  IF v_load_count <> v_token_count THEN
    RAISE EXCEPTION 'QR migration copy mismatch: % freight loads, % private tokens',
      v_load_count, v_token_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.freight_loads AS fl
    JOIN private.freight_load_qr_tokens AS qt ON qt.freight_load_id = fl.id
    WHERE qt.token IS DISTINCT FROM fl.qr_token
  ) THEN
    RAISE EXCEPTION 'Existing QR tokens do not match the private token copy';
  END IF;
END;
$$;

-- During the transition, mirror the existing token so the old frontend and QR scanner keep working.
CREATE OR REPLACE FUNCTION private.create_freight_load_qr_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO private.freight_load_qr_tokens (freight_load_id, token)
  VALUES (NEW.id, NEW.qr_token)
  ON CONFLICT (freight_load_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.create_freight_load_qr_token() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS freight_loads_create_private_qr_token ON public.freight_loads;
CREATE TRIGGER freight_loads_create_private_qr_token
AFTER INSERT ON public.freight_loads
FOR EACH ROW
EXECUTE FUNCTION private.create_freight_load_qr_token();

CREATE OR REPLACE FUNCTION public.get_freight_load_qr_token(p_freight_load_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_load public.freight_loads%ROWTYPE;
  v_token text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT fl.*
    INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carga não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_load.created_by = v_actor
    OR v_load.driver_id = v_actor
    OR v_load.supplier_id = v_actor
    OR v_load.buyer_id = v_actor
    OR public.is_agrilink_admin()
    OR public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'support_agent'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = v_load.product_id AND p.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1 FROM public.pre_orders AS po
      WHERE po.id = v_load.pre_order_id AND po.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = v_load.order_id AND o.user_id = v_actor
    )
  ) THEN
    RAISE EXCEPTION 'Não tem permissão para consultar o QR desta carga' USING ERRCODE = '42501';
  END IF;

  SELECT token INTO v_token
  FROM private.freight_load_qr_tokens
  WHERE freight_load_id = p_freight_load_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'QR desta carga indisponível' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_freight_load_qr_details(p_qr_token text)
RETURNS TABLE(
  id uuid,
  display_id text,
  qr_token text,
  product_name text,
  weight_kg numeric,
  origin_label text,
  destination_label text,
  pickup_date date,
  offered_price numeric,
  currency text,
  status text,
  notes text,
  route_distance_km numeric,
  route_duration_minutes integer,
  pre_order_id uuid,
  order_display_id text,
  order_status text,
  payment_status text,
  buyer_name text,
  buyer_phone text,
  driver_name text,
  driver_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_load public.freight_loads%ROWTYPE;
  v_load_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT freight_load_id
    INTO v_load_id
  FROM private.freight_load_qr_tokens
  WHERE token = p_qr_token
  LIMIT 1;

  IF v_load_id IS NULL THEN
    RAISE EXCEPTION 'Carga não encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT fl.*
    INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = v_load_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carga não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_load.created_by = v_actor
    OR v_load.driver_id = v_actor
    OR v_load.supplier_id = v_actor
    OR v_load.buyer_id = v_actor
    OR public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'support_agent'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = v_load.product_id AND p.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1 FROM public.pre_orders AS po
      WHERE po.id = v_load.pre_order_id AND po.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = v_load.order_id AND o.user_id = v_actor
    )
  ) THEN
    RAISE EXCEPTION 'Não tem permissão para consultar esta carga' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    v_load.id,
    left(v_load.id::text, 13),
    p_qr_token,
    v_load.product_name,
    v_load.weight_kg,
    v_load.origin_label,
    v_load.destination_label,
    v_load.pickup_date,
    v_load.offered_price,
    v_load.currency,
    v_load.status,
    v_load.notes,
    v_load.route_distance_km,
    v_load.route_duration_minutes,
    v_load.pre_order_id,
    CASE
      WHEN v_load.pre_order_id IS NOT NULL THEN left(v_load.pre_order_id::text, 13)
      WHEN v_load.order_id IS NOT NULL THEN left(v_load.order_id::text, 13)
      ELSE NULL
    END,
    COALESCE(
      (SELECT po.status FROM public.pre_orders AS po WHERE po.id = v_load.pre_order_id),
      (SELECT o.status::text FROM public.orders AS o WHERE o.id = v_load.order_id)
    ),
    (SELECT po.payment_status FROM public.pre_orders AS po WHERE po.id = v_load.pre_order_id),
    (SELECT u.full_name FROM public.pre_orders AS po JOIN public.users AS u ON u.id = po.user_id WHERE po.id = v_load.pre_order_id),
    (SELECT u.phone FROM public.pre_orders AS po JOIN public.users AS u ON u.id = po.user_id WHERE po.id = v_load.pre_order_id),
    (SELECT u.full_name FROM public.users AS u WHERE u.id = v_load.driver_id),
    (SELECT u.phone FROM public.users AS u WHERE u.id = v_load.driver_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_freight_load_qr_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_freight_load_qr_token(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_freight_load_qr_details(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_freight_load_qr_details(text) TO authenticated;

COMMIT;
