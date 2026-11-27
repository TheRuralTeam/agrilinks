-- Publish live driver coordinates only to users already authorized to view the load.
DROP POLICY IF EXISTS "Freight parties can view latest driver location" ON public.freight_load_locations;
CREATE POLICY "Freight parties can view latest driver location"
  ON public.freight_load_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.freight_loads AS load
      WHERE load.id = freight_load_locations.freight_load_id
        AND (
          load.created_by = (SELECT auth.uid())
          OR load.driver_id = (SELECT auth.uid())
          OR load.supplier_id = (SELECT auth.uid())
          OR load.buyer_id = (SELECT auth.uid())
          OR public.is_agrilink_admin()
        )
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_load_locations;
