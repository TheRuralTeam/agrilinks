-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20260410010425; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.


-- Update the products table to use pending_approval as default status for new products
-- No schema change needed as status is already a text field

-- Create a function to approve a product (admin only)
CREATE OR REPLACE FUNCTION public.admin_approve_product(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.is_root_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can approve products';
  END IF;
  
  UPDATE public.products 
  SET status = 'active', updated_at = now() 
  WHERE id = p_product_id AND status = 'pending_approval';
  
  RETURN FOUND;
END;
$$;

-- Create a function to reject a product (admin only)
CREATE OR REPLACE FUNCTION public.admin_reject_product(p_product_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.is_root_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can reject products';
  END IF;
  
  UPDATE public.products 
  SET status = 'rejected', updated_at = now() 
  WHERE id = p_product_id AND status = 'pending_approval';
  
  RETURN FOUND;
END;
$$;
