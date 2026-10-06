-- Production hardening: restrict SECURITY DEFINER RPCs to explicitly allowed callers,
-- and remove duplicate indexes/constraints without changing business behavior.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT EXECUTE ON FUNCTION public.get_agent_id_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_agent_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_email_otp(text, text) TO anon, authenticated;

ALTER FUNCTION public.send_message(uuid, uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.send_message(uuid, uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.payment_status_transition_allowed(text, text) SET search_path = public;

DROP INDEX IF EXISTS public.idx_conversations_participant_id;
DROP INDEX IF EXISTS public.idx_messages_conversation_id;
DROP INDEX IF EXISTS public.payment_intents_order_id_idx;
DROP INDEX IF EXISTS public.payment_intents_status_idx;
DROP INDEX IF EXISTS public.payment_intents_user_created_idx;

ALTER TABLE public.payment_webhook_events
  DROP CONSTRAINT IF EXISTS payment_webhook_events_provider_id_provider_event_id_key;
DROP INDEX IF EXISTS public.ux_payment_webhook_provider_event;

-- Existing freight location migration follows.
CREATE TABLE IF NOT EXISTS public.freight_load_locations (
  freight_load_id uuid PRIMARY KEY REFERENCES public.freight_loads(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  speed_mps double precision CHECK (speed_mps IS NULL OR speed_mps >= 0),
  heading_deg double precision CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freight_load_locations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.freight_load_locations TO authenticated;

DROP POLICY IF EXISTS "Freight parties can view latest driver location" ON public.freight_load_locations;
CREATE POLICY "Freight parties can view latest driver location"
  ON public.freight_load_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.freight_loads AS load
      WHERE load.id = freight_load_id
        AND (
          load.created_by = auth.uid()
          OR load.driver_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "Assigned driver can share location while in transit" ON public.freight_load_locations;
CREATE POLICY "Assigned driver can share location while in transit"
  ON public.freight_load_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.freight_loads AS load
      WHERE load.id = freight_load_id
        AND load.driver_id = auth.uid()
        AND load.status = 'in_transit'
    )
  );

DROP POLICY IF EXISTS "Assigned driver can update shared location while in transit" ON public.freight_load_locations;
CREATE POLICY "Assigned driver can update shared location while in transit"
  ON public.freight_load_locations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.freight_loads AS load
      WHERE load.id = freight_load_id
        AND load.driver_id = auth.uid()
        AND load.status = 'in_transit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.freight_loads AS load
      WHERE load.id = freight_load_id
        AND load.driver_id = auth.uid()
        AND load.status = 'in_transit'
    )
  );

CREATE OR REPLACE FUNCTION public.set_freight_location_recorded_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.recorded_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freight_location_recorded_at ON public.freight_load_locations;
CREATE TRIGGER freight_location_recorded_at
  BEFORE INSERT OR UPDATE ON public.freight_load_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_freight_location_recorded_at();
