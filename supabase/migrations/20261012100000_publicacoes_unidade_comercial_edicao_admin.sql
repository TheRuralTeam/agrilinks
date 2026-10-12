-- Publicações agrícolas: unidade comercial explícita, acondicionamento e edição administrativa auditável.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_unit text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS min_order_quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS package_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS product_variety text,
  ADD COLUMN IF NOT EXISTS product_condition text,
  ADD COLUMN IF NOT EXISTS packaging_type text;

ALTER TABLE public.products
  ADD CONSTRAINT products_sale_unit_check
    CHECK (sale_unit IN ('kg', 'tonelada', 'unidade', 'caixa', 'saco', 'litro')),
  ADD CONSTRAINT products_min_order_quantity_check
    CHECK (min_order_quantity > 0),
  ADD CONSTRAINT products_min_order_quantity_integer_check
    CHECK (min_order_quantity = trunc(min_order_quantity)),
  ADD CONSTRAINT products_package_weight_kg_check
    CHECK (package_weight_kg IS NULL OR package_weight_kg > 0);

CREATE TABLE IF NOT EXISTS public.product_admin_edit_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  before_values jsonb NOT NULL,
  after_values jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_admin_edit_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_admin_edit_audit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_product(
  p_product_id uuid,
  p_product_type text,
  p_quantity numeric,
  p_price numeric,
  p_sale_unit text,
  p_min_order_quantity numeric,
  p_package_weight_kg numeric,
  p_product_variety text,
  p_product_condition text,
  p_packaging_type text,
  p_description text,
  p_harvest_date date,
  p_province_id text,
  p_municipality_id text,
  p_logistics_access text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_reserved numeric;
BEGIN
  IF v_actor IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND (u.is_root_admin IS TRUE OR u.is_super_root IS TRUE))
    OR EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'manage_products')
  ) THEN
    RAISE EXCEPTION 'Não tem permissão para editar publicações.' USING ERRCODE = '42501';
  END IF;

  IF p_product_type IS NULL OR length(trim(p_product_type)) < 2
     OR p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity)
     OR p_price IS NULL OR p_price <= 0
     OR p_min_order_quantity IS NULL OR p_min_order_quantity <= 0 OR p_min_order_quantity <> trunc(p_min_order_quantity) OR p_min_order_quantity > p_quantity
     OR (p_package_weight_kg IS NOT NULL AND p_package_weight_kg <= 0)
     OR p_sale_unit IS NULL OR p_sale_unit NOT IN ('kg', 'tonelada', 'unidade', 'caixa', 'saco', 'litro')
     OR p_logistics_access IS NULL OR p_logistics_access NOT IN ('sim', 'nao', 'parcial')
     OR p_province_id IS NULL OR trim(p_province_id) = ''
     OR p_municipality_id IS NULL OR trim(p_municipality_id) = ''
 THEN
    RAISE EXCEPTION 'Os dados da publicação são inválidos.' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(p), coalesce(p.reserved_quantity, 0)
    INTO v_before, v_reserved
    FROM public.products p
    WHERE p.id = p_product_id
    FOR UPDATE;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Publicação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF p_quantity < v_reserved THEN
    RAISE EXCEPTION 'A quantidade não pode ficar abaixo do stock já reservado.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.products
  SET product_type = trim(p_product_type),
      quantity = p_quantity,
      price = p_price,
      sale_unit = p_sale_unit,
      min_order_quantity = p_min_order_quantity,
      package_weight_kg = p_package_weight_kg,
      product_variety = nullif(trim(coalesce(p_product_variety, '')), ''),
      product_condition = nullif(trim(coalesce(p_product_condition, '')), ''),
      packaging_type = nullif(trim(coalesce(p_packaging_type, '')), ''),
      description = nullif(trim(coalesce(p_description, '')), ''),
      harvest_date = p_harvest_date,
      province_id = trim(p_province_id),
      municipality_id = trim(p_municipality_id),
      logistics_access = p_logistics_access,
      updated_at = now()
  WHERE id = p_product_id
  RETURNING to_jsonb(products) INTO v_after;

  INSERT INTO public.product_admin_edit_audit(product_id, admin_user_id, before_values, after_values)
  VALUES (p_product_id, v_actor, v_before, v_after);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_product(uuid,text,numeric,numeric,text,numeric,numeric,text,text,text,text,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_product(uuid,text,numeric,numeric,text,numeric,numeric,text,text,text,text,date,text,text,text) TO authenticated;
