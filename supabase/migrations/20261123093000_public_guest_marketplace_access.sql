-- Public marketplace access for landing-page and guest browsing.
-- Visitors may read only active listings; writes remain protected by RLS.

DROP POLICY IF EXISTS "Todos podem ver produtos ativos" ON public.products;

CREATE POLICY "Todos podem ver produtos ativos"
ON public.products
FOR SELECT
TO anon, authenticated
USING (status = 'active');

GRANT SELECT ON TABLE public.products TO anon, authenticated;

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
  p.sale_unit,
  p.min_order_quantity
FROM public.products p
WHERE p.status = 'active';

GRANT SELECT ON TABLE public.products_public TO anon, authenticated;
