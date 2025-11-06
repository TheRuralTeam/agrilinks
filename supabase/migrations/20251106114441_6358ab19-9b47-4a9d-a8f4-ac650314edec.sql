-- Fix: Add policy for INSERT on user_roles (admins can assign roles)
-- For now, allow authenticated users to insert their own role (user by default)
-- In production, you would restrict this to admins only

CREATE POLICY "Users can insert own user role on signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'user');

-- Optional: Add policy for admins to manage all roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));