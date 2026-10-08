-- Endurece a máquina de estados das cargas de transporte.
-- A criação de cargas comuns continua disponível ao utilizador autenticado,
-- mas cargas ligadas a pré-pedidos e todas as transições posteriores passam
-- pelos RPCs autorizados do fluxo logístico.

REVOKE UPDATE, DELETE ON TABLE public.freight_loads FROM anon, authenticated;

DROP POLICY IF EXISTS "Owners can create freight loads" ON public.freight_loads;

CREATE POLICY "Owners can create freight loads"
ON public.freight_loads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND driver_id IS NULL
  AND status IN ('available', 'open', 'agendado')
  AND pre_order_id IS NULL
);
