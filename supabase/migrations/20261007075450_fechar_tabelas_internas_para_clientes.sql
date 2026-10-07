-- Estas tabelas guardam filas, limites, cache e eventos internos.
-- Os clientes da aplicação não devem consultar ou alterar estes dados diretamente.
REVOKE ALL ON TABLE public.email_outbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.map_geocoding_cache FROM anon, authenticated;
REVOKE ALL ON TABLE public.map_geocoding_state FROM anon, authenticated;
REVOKE ALL ON TABLE public.notification_push_queue FROM anon, authenticated;
REVOKE ALL ON TABLE public.payment_intent_rate_limits FROM anon, authenticated;
REVOKE ALL ON TABLE public.payment_webhook_events FROM anon, authenticated;

-- O preço do frete pode ser lido pela aplicação autenticada,
-- mas alterações continuam reservadas às funções administrativas.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.freight_pricing_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.freight_pricing_settings TO authenticated;

-- Rate limit é controlado pelas funções do banco, não pelo cliente.
REVOKE ALL ON TABLE public.api_rate_limits FROM anon, authenticated;
