-- Keep public product browsing on the safe view instead of evaluating
-- administrative policies on the base table.
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
  p.updated_at,
  p.sale_unit
FROM public.products p
WHERE p.status = 'active';

GRANT SELECT ON public.products_public TO anon, authenticated;

COMMENT ON VIEW public.products_public IS 'Public feed view. Only active listings and public product metadata are exposed.';
