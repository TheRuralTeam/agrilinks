BEGIN;

ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS quality_specification text,
  ADD COLUMN IF NOT EXISTS delivery_province_id text,
  ADD COLUMN IF NOT EXISTS delivery_municipality_id text,
  ADD COLUMN IF NOT EXISTS delivery_location text;

ALTER TABLE public.sourcing_requests
  DROP CONSTRAINT IF EXISTS sourcing_requests_unit_check,
  ADD CONSTRAINT sourcing_requests_unit_check
    CHECK (unit IN ('kg', 'tonelada', 'saco', 'caixa', 'unidade'));

ALTER TABLE public.sourcing_requests
  DROP CONSTRAINT IF EXISTS sourcing_requests_quality_specification_length_check,
  ADD CONSTRAINT sourcing_requests_quality_specification_length_check
    CHECK (quality_specification IS NULL OR char_length(quality_specification) <= 1000);

ALTER TABLE public.sourcing_requests
  DROP CONSTRAINT IF EXISTS sourcing_requests_delivery_location_length_check,
  ADD CONSTRAINT sourcing_requests_delivery_location_length_check
    CHECK (delivery_location IS NULL OR char_length(delivery_location) <= 180);

COMMENT ON COLUMN public.sourcing_requests.unit IS 'Unidade solicitada pelo comprador.';
COMMENT ON COLUMN public.sourcing_requests.quality_specification IS 'Requisitos de qualidade, calibre, maturação, embalagem ou apresentação.';
COMMENT ON COLUMN public.sourcing_requests.delivery_province_id IS 'Identificador da província de entrega.';
COMMENT ON COLUMN public.sourcing_requests.delivery_municipality_id IS 'Identificador do município de entrega.';
COMMENT ON COLUMN public.sourcing_requests.delivery_location IS 'Mercado, armazém, fazenda ou referência complementar para a entrega.';

COMMIT;
