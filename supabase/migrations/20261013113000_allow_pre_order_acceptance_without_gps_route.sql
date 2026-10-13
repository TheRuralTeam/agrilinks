-- Allow a supplier to accept a pre-order even when GPS coordinates are incomplete.
-- The freight load is still created; dispatch must confirm the route before transport.
CREATE OR REPLACE FUNCTION public.create_freight_load_for_accepted_pre_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_origin_label text;
  v_destination_label text;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = NEW.product_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot create freight load: product not found'
        USING ERRCODE = 'P0002';
    END IF;

    v_origin_label := COALESCE(
      NULLIF(CONCAT_WS(', ', NULLIF(BTRIM(v_product.municipality_id), ''), NULLIF(BTRIM(v_product.province_id), '')), ''),
      'Origem por confirmar'
    );
    v_destination_label := COALESCE(NULLIF(BTRIM(NEW.location), ''), 'Destino por confirmar');

    -- Acceptance and GPS route confirmation are separate steps.
    -- Coordinates stay NULL until a valid route is supplied; do not block the order.
    INSERT INTO public.freight_loads (
      created_by,
      pre_order_id,
      product_id,
      product_name,
      weight_kg,
      origin_label,
      origin_lat,
      origin_lng,
      destination_label,
      destination_lat,
      destination_lng,
      pickup_date,
      currency,
      status,
      notes,
      supplier_id,
      buyer_id
    )
    VALUES (
      v_product.user_id,
      NEW.id,
      v_product.id,
      v_product.product_type,
      NEW.quantity,
      v_origin_label,
      v_product.location_lat,
      v_product.location_lng,
      v_destination_label,
      NEW.destination_lat,
      NEW.destination_lng,
      v_product.harvest_date,
      'Kz',
      'available',
      CASE
        WHEN v_product.location_lat IS NULL OR v_product.location_lng IS NULL
          OR NEW.destination_lat IS NULL OR NEW.destination_lng IS NULL
        THEN 'Carga criada após aceitação. Coordenadas GPS da rota devem ser confirmadas antes do transporte.'
        ELSE 'Carga criada automaticamente a partir de um pedido AgriLink.'
      END,
      v_product.user_id,
      NEW.user_id
    )
    ON CONFLICT (pre_order_id) WHERE pre_order_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
