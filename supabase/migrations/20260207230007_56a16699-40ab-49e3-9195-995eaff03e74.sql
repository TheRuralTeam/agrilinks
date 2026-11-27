
-- Function to cascade delete a single product
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete products';
  END IF;

  -- Delete related data in correct order to avoid FK violations
  DELETE FROM public.comment_likes WHERE comment_id IN (SELECT id FROM public.product_comments WHERE product_id = p_product_id);
  DELETE FROM public.comment_replies WHERE comment_id IN (SELECT id FROM public.product_comments WHERE product_id = p_product_id);
  DELETE FROM public.product_comments WHERE product_id = p_product_id;
  DELETE FROM public.product_likes WHERE product_id = p_product_id;
  DELETE FROM public.delivery_tracking WHERE order_id IN (SELECT id FROM public.orders WHERE product_id = p_product_id);
  DELETE FROM public.orders WHERE product_id = p_product_id;
  DELETE FROM public.pre_orders WHERE product_id = p_product_id;

  -- Finally delete the product
  DELETE FROM public.products WHERE id = p_product_id;

  -- Log the action
  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'PRODUCT_DELETED',
    'PRODUCT_DELETED',
    auth.uid(),
    jsonb_build_object('deleted_product_id', p_product_id, 'deleted_at', NOW())
  );

  RETURN true;
END;
$$;

-- Function to bulk delete products
CREATE OR REPLACE FUNCTION public.admin_bulk_delete_products(p_product_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_count integer := 0;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete products';
  END IF;

  FOREACH v_product_id IN ARRAY p_product_ids
  LOOP
    PERFORM public.admin_delete_product(v_product_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
