BEGIN;

CREATE TABLE IF NOT EXISTS public.user_delivery_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_location text NOT NULL CHECK (char_length(btrim(delivery_location)) BETWEEN 3 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_delivery_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cada utilizador gere apenas a sua localização preferida" ON public.user_delivery_preferences;
CREATE POLICY "Cada utilizador gere apenas a sua localização preferida"
  ON public.user_delivery_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_delivery_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_delivery_preferences TO authenticated;

COMMIT;