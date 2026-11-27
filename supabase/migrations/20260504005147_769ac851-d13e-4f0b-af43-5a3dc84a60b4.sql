
-- Tabela de verificações IA entre produtos e fichas técnicas
CREATE TABLE public.product_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  ficha_id uuid NOT NULL,
  producer_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  match_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- match | partial | mismatch
  ai_analysis jsonb,
  issues text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem todas verificações"
ON public.product_verifications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Produtor vê suas verificações"
ON public.product_verifications FOR SELECT
USING (auth.uid() = producer_id);

CREATE POLICY "Comprador vê suas verificações"
ON public.product_verifications FOR SELECT
USING (auth.uid() = buyer_id);

CREATE POLICY "Sistema insere verificações"
ON public.product_verifications FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_pv_product ON public.product_verifications(product_id);
CREATE INDEX idx_pv_ficha ON public.product_verifications(ficha_id);
