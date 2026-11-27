-- Public-safe views for neutral app browsing.
-- This keeps personal or sensitive data out of the public surface while the real feed still reads real public content.

CREATE OR REPLACE VIEW public.users_public AS
SELECT
  u.id,
  u.full_name,
  COALESCE(u.display_name, u.full_name) AS display_name,
  u.avatar_url,
  u.user_type,
  u.province_id,
  u.municipality_id,
  u.created_at,
  u.verified,
  u.email_verified,
  u.bio,
  u.description
FROM public.users u;

CREATE OR REPLACE VIEW public.products_public AS
SELECT
  p.id,
  p.user_id,
  p.product_type,
  p.quantity,
  p.price,
  p.status,
  p.harvest_date,
  p.province_id,
  p.municipality_id,
  p.farmer_name,
  p.photos,
  p.description,
  p.created_at,
  p.updated_at
FROM public.products p
WHERE p.status = 'active';

GRANT SELECT ON public.users_public TO anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;

COMMENT ON VIEW public.users_public IS 'Public-safe user profile data only. Private fields such as email, phone, password, tokens and payment data are intentionally excluded.';
COMMENT ON VIEW public.products_public IS 'Public feed view. Only active listings and public product metadata are exposed.';
