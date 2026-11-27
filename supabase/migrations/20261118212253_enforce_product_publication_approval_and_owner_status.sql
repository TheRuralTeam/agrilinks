-- Prevent clients from bypassing product approval or changing approval status.
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios produtos" ON public.products;

CREATE POLICY "Producers submit products for approval"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    (
      status = 'pending_approval'
      AND EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = auth.uid()
          AND u.user_type::text IN ('agricultor', 'agente')
      )
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_root_admin(auth.uid())
    OR public.is_super_root(auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.enforce_product_owner_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  privileged_actor boolean := false;
BEGIN
  IF actor_id IS NULL THEN
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  privileged_actor :=
    public.has_role(actor_id, 'admin'::public.app_role)
    OR public.is_root_admin(actor_id)
    OR public.is_super_root(actor_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS DISTINCT FROM actor_id THEN
      RAISE EXCEPTION 'Products can only be created for the authenticated owner'
        USING ERRCODE = '42501';
    END IF;

    IF NOT privileged_actor THEN
      IF NEW.status IS DISTINCT FROM 'pending_approval' THEN
        RAISE EXCEPTION 'New products must enter pending approval'
          USING ERRCODE = '42501';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = actor_id
          AND u.user_type::text IN ('agricultor', 'agente')
      ) THEN
        RAISE EXCEPTION 'Only registered producers and agents can publish products'
          USING ERRCODE = '42501';
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF actor_id = OLD.user_id AND NOT privileged_actor THEN
      IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Product ownership cannot be changed'
          USING ERRCODE = '42501';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status
         AND NEW.status IS DISTINCT FROM 'removed' THEN
        RAISE EXCEPTION 'Only administrators can change product approval or availability status'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_product_owner_status_guard ON public.products;
CREATE TRIGGER trg_enforce_product_owner_status_guard
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_product_owner_status_guard();

REVOKE ALL ON FUNCTION public.enforce_product_owner_status_guard() FROM PUBLIC, anon, authenticated;
