-- Identity is required only when an operation creates a legal/market representation.
DROP TRIGGER IF EXISTS trg_require_identity_for_freight_load ON public.freight_loads;
CREATE TRIGGER trg_require_identity_for_freight_load
BEFORE INSERT ON public.freight_loads
FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_for_market_action();

DROP TRIGGER IF EXISTS trg_require_identity_for_futures_contract ON public.futures_contracts;
CREATE TRIGGER trg_require_identity_for_futures_contract
BEFORE INSERT ON public.futures_contracts
FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_for_market_action();
