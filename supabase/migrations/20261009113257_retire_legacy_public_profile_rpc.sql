-- The public profile table is the supported safe interface; this legacy RPC returns unnecessary location and referral fields.
REVOKE ALL ON FUNCTION public.get_public_user_profile(uuid) FROM PUBLIC, anon, authenticated;
