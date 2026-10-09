-- Replace the owner-privileged view with a dedicated, least-privilege public profile table.
DROP VIEW IF EXISTS public.public_user_profiles;

CREATE TABLE public.public_user_profiles (
  id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text,
  user_type public.user_type_enum,
  avatar_url text,
  verified boolean NOT NULL DEFAULT false
);

ALTER TABLE public.public_user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.public_user_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_user_profiles TO anon, authenticated;

CREATE POLICY "Public profile fields are visible to marketplace users"
  ON public.public_user_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.public_user_profiles (id, full_name, user_type, avatar_url, verified)
  VALUES (NEW.id, NEW.full_name, NEW.user_type, NEW.avatar_url, COALESCE(NEW.verified, false))
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    user_type = EXCLUDED.user_type,
    avatar_url = EXCLUDED.avatar_url,
    verified = EXCLUDED.verified;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_user_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_public_user_profile_after_user_change ON public.users;
CREATE TRIGGER sync_public_user_profile_after_user_change
AFTER INSERT OR UPDATE OF full_name, user_type, avatar_url, verified
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_user_profile();

INSERT INTO public.public_user_profiles (id, full_name, user_type, avatar_url, verified)
SELECT id, full_name, user_type, avatar_url, COALESCE(verified, false)
FROM public.users
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  user_type = EXCLUDED.user_type,
  avatar_url = EXCLUDED.avatar_url,
  verified = EXCLUDED.verified;
