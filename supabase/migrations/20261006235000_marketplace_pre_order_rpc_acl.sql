-- Marketplace purchase RPC is authenticated-only.
REVOKE EXECUTE ON FUNCTION public.create_marketplace_pre_order(uuid,numeric,text,double precision,double precision,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_marketplace_pre_order(uuid,numeric,text,double precision,double precision,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_pre_order(uuid,numeric,text,double precision,double precision,uuid) TO authenticated;
