-- The current recipient registry has no platform-only discriminator.
-- Until it can prove that every destination is an AgriLink-owned account,
-- buyers must not be able to obtain or create manual third-party payment intents.
begin;

revoke all on function public.get_marketplace_payment_recipients(uuid)
  from public, anon, authenticated;

revoke all on function public.create_authorized_recipient_payment_intent(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.submit_authorized_recipient_payment_proof(uuid, text, text)
  from public, anon, authenticated;

commit;
