begin;

do $$
begin
  if has_function_privilege('anon', 'public.get_marketplace_payment_recipients(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_marketplace_payment_recipients(uuid)', 'EXECUTE') then
    raise exception 'buyers must not enumerate unscoped payment recipients';
  end if;

  if has_function_privilege('anon', 'public.create_authorized_recipient_payment_intent(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_authorized_recipient_payment_intent(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'buyers must not create unscoped third-party payment intents';
  end if;

  if has_function_privilege('anon', 'public.submit_authorized_recipient_payment_proof(uuid,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.submit_authorized_recipient_payment_proof(uuid,text,text)', 'EXECUTE') then
    raise exception 'buyers must not submit proof for unscoped recipient payments';
  end if;
end;
$$;

rollback;
