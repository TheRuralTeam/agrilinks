-- Restrict direct access to account records and expose only safe public profile fields.
DROP POLICY IF EXISTS "Usuários podem ver perfis públicos básicos" ON public.users;

REVOKE ALL PRIVILEGES ON TABLE public.users FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.users FROM authenticated;

-- Authenticated users can read rows allowed by RLS (own profile, authorized operations/admins).
GRANT SELECT ON TABLE public.users TO authenticated;

-- Profile editing only: account type, verification, agent code and admin flags remain server-controlled.
GRANT UPDATE (
  full_name,
  phone,
  province_id,
  municipality_id,
  identity_document,
  avatar_url,
  load_capacity_kg,
  updated_at
) ON TABLE public.users TO authenticated;

-- Anonymous visitors and marketplace clients receive only the fields needed to identify a seller.
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT id, full_name, user_type, avatar_url, verified
FROM public.users;

GRANT SELECT ON TABLE public.public_user_profiles TO anon, authenticated;

-- Reveal buyer contact details only to the buyer, the seller of the ordered product, or support/admin staff.
CREATE OR REPLACE FUNCTION public.get_order_buyer_contact(p_pre_order_id uuid)
RETURNS TABLE(full_name text, phone text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_seller_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT po.user_id, p.user_id
    INTO v_buyer_id, v_seller_id
  FROM public.pre_orders AS po
  JOIN public.products AS p ON p.id = po.product_id
  WHERE po.id = p_pre_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pre-order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_id <> v_buyer_id
     AND v_actor_id <> v_seller_id
     AND NOT public.has_role(v_actor_id, 'admin'::public.app_role)
     AND NOT public.is_support_agent(v_actor_id) THEN
    RAISE EXCEPTION 'Not authorized to view order contact details' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.full_name, u.phone, u.email
  FROM public.users AS u
  WHERE u.id = v_buyer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_buyer_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_buyer_contact(uuid) TO authenticated;
