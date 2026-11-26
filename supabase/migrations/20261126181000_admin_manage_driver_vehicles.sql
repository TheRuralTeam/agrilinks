-- Allow authorized AgriLink administrators to review and manage private driver vehicle records.
-- Driver-owned read/insert policies remain in place; no anonymous access is granted.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_vehicles TO authenticated;

DROP POLICY IF EXISTS "Admins can manage driver vehicles" ON public.driver_vehicles;
CREATE POLICY "Admins can manage driver vehicles"
  ON public.driver_vehicles
  FOR ALL
  TO authenticated
  USING (public.is_agrilink_admin())
  WITH CHECK (public.is_agrilink_admin());
