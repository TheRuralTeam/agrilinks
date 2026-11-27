-- Add RLS policy to allow admins to insert notifications for any user
CREATE POLICY "Admins can insert notifications for any user"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'moderator'::app_role)
);