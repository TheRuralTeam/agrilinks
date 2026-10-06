-- Marketplace production performance: fast active feed ordering and text search.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_products_active_created_at
  ON public.products (created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_product_type_trgm
  ON public.products USING gin (product_type extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_farmer_name_trgm
  ON public.products USING gin (farmer_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_description_trgm
  ON public.products USING gin (description extensions.gin_trgm_ops);
