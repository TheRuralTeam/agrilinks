ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (status = ANY (ARRAY['active','inactive','removed','pending_approval','rejected','sold','unavailable']::text[]));

CREATE OR REPLACE FUNCTION public.admin_set_product_status(p_product_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR (NOT public.has_role(auth.uid(), 'admin') AND NOT public.is_root_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can change product status';
  END IF;

  IF p_status NOT IN ('active', 'sold', 'unavailable') THEN
    RAISE EXCEPTION 'Invalid product status';
  END IF;

  UPDATE public.products
     SET status = p_status,
         updated_at = now()
   WHERE id = p_product_id;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_product_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_product_status(uuid, text) TO authenticated;
