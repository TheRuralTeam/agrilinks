drop function if exists public.create_authorized_recipient_payment_intent(uuid,uuid,uuid);
create function public.create_authorized_recipient_payment_intent(p_pre_order_id uuid,p_recipient_id uuid,p_idempotency_key uuid)
returns table(intent_id uuid,pre_order_id uuid,amount numeric,currency text,status text,recipient_id uuid,recipient_name text,account_identifier text,channel text,bank_name text,account_holder text,instructions text)
language plpgsql security definer set search_path=''
as $$
declare
 v_order public.pre_orders%rowtype; v_freight numeric:=0; v_total numeric;
 v_rec public.payment_authorized_recipients%rowtype; v_intent public.payment_intents%rowtype; v_snapshot jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_pre_order_id is null or p_recipient_id is null or p_idempotency_key is null then raise exception 'INVALID_PAYMENT_REQUEST' using errcode='22023'; end if;
 select * into v_order from public.pre_orders where id=p_pre_order_id and user_id=auth.uid() for update;
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
 if v_order.status<>'accepted' then raise exception 'CHECKOUT_NOT_READY' using errcode='22023'; end if;
 if coalesce(v_order.payment_status,'unpaid')<>'unpaid' then raise exception 'ORDER_PAYMENT_NOT_UNPAID' using errcode='22023'; end if;
 select coalesce((select coalesce(fl.offered_price,fl.driver_offered_price,0) from public.freight_loads fl where fl.pre_order_id=v_order.id order by fl.created_at desc limit 1),0) into v_freight;
 if v_freight<=0 then raise exception 'FREIGHT_QUOTE_REQUIRED' using errcode='22023'; end if;
 v_total:=v_order.total_price+v_freight;
 select * into v_intent from public.payment_intents where user_id=auth.uid() and idempotency_key=p_idempotency_key for update;
 if found then
  if v_intent.pre_order_id is distinct from p_pre_order_id or v_intent.provider_id is distinct from 'agrilink_authorized_recipient' or v_intent.purpose is distinct from 'order_payment' or v_intent.amount is distinct from v_total or v_intent.provider_payload->>'recipient_id' is distinct from p_recipient_id::text then raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' using errcode='22023'; end if;
  v_snapshot:=coalesce(v_intent.provider_payload->'recipient_snapshot','{}'::jsonb);
  if v_snapshot='{}'::jsonb then
   select * into v_rec from public.payment_authorized_recipients where id=p_recipient_id;
   v_snapshot:=jsonb_build_object('display_name',coalesce(v_rec.display_name,v_intent.provider_payload->>'recipient_name',''),'channel',v_rec.channel,'bank_name',v_rec.bank_name,'account_identifier',v_rec.account_identifier,'account_holder',v_rec.account_holder,'instructions',v_rec.instructions,'currency',coalesce(v_rec.currency,'AOA'));
  end if;
  return query select v_intent.id,v_intent.pre_order_id,v_intent.amount,v_intent.currency::text,v_intent.status,p_recipient_id,coalesce(v_snapshot->>'display_name',''),coalesce(v_snapshot->>'account_identifier',''),coalesce(v_snapshot->>'channel','bank_transfer'),v_snapshot->>'bank_name',coalesce(v_snapshot->>'account_holder',''),v_snapshot->>'instructions';
  return;
 end if;
 if exists(select 1 from public.payment_intents pi where pi.pre_order_id=p_pre_order_id and pi.status in ('created','pending','processing')) then raise exception 'PAYMENT_INTENT_ALREADY_EXISTS' using errcode='23505'; end if;
 select * into v_rec from public.payment_authorized_recipients where id=p_recipient_id and active=true and verified_at is not null and archived_at is null and (max_amount is null or max_amount>=v_total) for update;
 if not found then raise exception 'PAYMENT_RECIPIENT_UNAVAILABLE' using errcode='22023'; end if;
 v_snapshot:=jsonb_build_object('recipient_id',v_rec.id,'display_name',v_rec.display_name,'channel',v_rec.channel,'bank_name',v_rec.bank_name,'account_identifier',v_rec.account_identifier,'account_holder',v_rec.account_holder,'instructions',v_rec.instructions,'currency',v_rec.currency,'captured_at',now());
 insert into public.payment_intents(user_id,provider_id,idempotency_key,amount,currency,status,purpose,description,provider_payload,refunded_amount,pre_order_id)
 values(auth.uid(),'agrilink_authorized_recipient',p_idempotency_key,v_total,'AOA','pending','order_payment','Pagamento AgriLink por beneficiário oficial',jsonb_build_object('recipient_id',v_rec.id,'recipient_name',v_rec.display_name,'recipient_snapshot',v_snapshot),0,p_pre_order_id)
 returning * into v_intent;
 insert into public.payment_attempts(payment_intent_id,provider_id,attempt_number,status,request_payload,response_payload)
 values(v_intent.id,'agrilink_authorized_recipient',1,'pending',jsonb_build_object('recipient_id',v_rec.id,'recipient_snapshot',v_snapshot),'{}'::jsonb);
 return query select v_intent.id,v_intent.pre_order_id,v_intent.amount,v_intent.currency::text,v_intent.status,v_rec.id,v_rec.display_name,v_rec.account_identifier,v_rec.channel,v_rec.bank_name,v_rec.account_holder,v_rec.instructions;
end $$;
revoke all on function public.create_authorized_recipient_payment_intent(uuid,uuid,uuid) from public,anon;
grant execute on function public.create_authorized_recipient_payment_intent(uuid,uuid,uuid) to authenticated;
