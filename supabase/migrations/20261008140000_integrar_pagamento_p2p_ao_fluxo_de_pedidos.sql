-- Integra o P2P ao ciclo de pagamentos e expira operações pendentes automaticamente.
create or replace function public.create_p2p_order(p_pre_order_id uuid,p_payment_channel text) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 v_order_id uuid; v_intent_id uuid; v_buyer uuid; v_amount numeric; v_count integer:=0; v_b record; v_key uuid:=gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_payment_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay') then raise exception 'INVALID_PAYMENT_CHANNEL'; end if;
 select buyer_id,total_price into v_buyer,v_amount from pre_orders where id=p_pre_order_id and status='accepted' and coalesce(payment_status,'unpaid')<>'paid' for update;
 if not found then raise exception 'PRE_ORDER_NOT_READY'; end if;
 if v_buyer<>auth.uid() then raise exception 'FORBIDDEN'; end if;
 if v_amount is null or v_amount<=0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
 if exists(select 1 from p2p_orders where pre_order_id=p_pre_order_id and status not in ('cancelled','expired','rejected','refunded')) then raise exception 'P2P_ORDER_ALREADY_EXISTS'; end if;
 insert into p2p_orders(buyer_id,pre_order_id,amount,currency,payment_channel,status,expires_at)
 values(auth.uid(),p_pre_order_id,v_amount,'AOA',p_payment_channel,'matching',now()+interval '15 minutes') returning id into v_order_id;
 insert into payment_intents(user_id,provider_id,idempotency_key,amount,currency,status,expires_at,purpose,description,provider_payload,pre_order_id)
 values(auth.uid(),'agrilink_authorized_recipient',v_key,v_amount,'AOA','created',now()+interval '15 minutes','p2p_payment','Pagamento P2P AgriLink',
 jsonb_build_object('p2p_order_id',v_order_id,'payment_channel',p_payment_channel),p_pre_order_id) returning id into v_intent_id;
 insert into payment_attempts(payment_intent_id,provider_id,attempt_number,status,request_payload)
 values(v_intent_id,'agrilink_authorized_recipient',1,'created',jsonb_build_object('p2p_order_id',v_order_id,'payment_channel',p_payment_channel));
 update p2p_orders set payment_intent_id=v_intent_id where id=v_order_id;
 for v_b in
   select b.id beneficiary_id,coalesce(r.score,0) score,b.completion_rate,b.average_completion_seconds
   from p2p_beneficiaries b join p2p_beneficiary_accounts a on a.beneficiary_id=b.id and a.channel=p_payment_channel and a.active and a.verified_at is not null
   left join p2p_reputation r on r.beneficiary_id=b.id
   where b.status='active' and b.availability_status='online' and b.user_id<>auth.uid()
   and (b.per_transaction_limit=0 or b.per_transaction_limit>=v_amount) and (a.max_amount=0 or a.max_amount>=v_amount)
   and (select count(*) from p2p_orders o where o.beneficiary_id=b.id and o.status in ('accepted','payment_pending','payment_submitted','payment_detected','under_review'))<b.simultaneous_limit
   and (b.daily_limit=0 or coalesce((select sum(o.amount) from p2p_orders o where o.beneficiary_id=b.id and o.created_at>=date_trunc('day',now()) and o.status not in ('cancelled','expired','rejected','refunded')),0)+v_amount<=b.daily_limit)
   and (b.monthly_limit=0 or coalesce((select sum(o.amount) from p2p_orders o where o.beneficiary_id=b.id and o.created_at>=date_trunc('month',now()) and o.status not in ('cancelled','expired','rejected','refunded')),0)+v_amount<=b.monthly_limit)
   order by coalesce(r.score,0) desc,b.completion_rate desc,b.average_completion_seconds asc,b.updated_at asc limit 5
 loop
   insert into p2p_matches(p2p_order_id,beneficiary_id,score) values(v_order_id,v_b.beneficiary_id,(v_b.score*0.7)+(v_b.completion_rate*0.3)); v_count:=v_count+1;
 end loop;
 if v_count>0 then update p2p_orders set status='offered',updated_at=now() where id=v_order_id; end if;
 insert into p2p_transaction_events(p2p_order_id,event_type,to_status,actor_id,metadata)
 values(v_order_id,'p2p.order.created',case when v_count>0 then 'offered' else 'matching' end,auth.uid(),jsonb_build_object('matches',v_count,'payment_intent_id',v_intent_id));
 return v_order_id;
end $$;

create or replace function public.submit_p2p_payment_proof(p_p2p_order_id uuid,p_transfer_reference text,p_note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_order p2p_orders%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if nullif(trim(p_transfer_reference),'') is null then raise exception 'TRANSFER_REFERENCE_REQUIRED'; end if;
 select * into v_order from p2p_orders where id=p_p2p_order_id for update;
 if not found or v_order.buyer_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
 if v_order.status<>'payment_pending' then raise exception 'INVALID_P2P_STATUS'; end if;
 if v_order.expires_at<=now() then update p2p_orders set status='expired',updated_at=now() where id=v_order.id; update payment_intents set status='expired',failure_code='P2P_ORDER_EXPIRED',updated_at=now() where id=v_order.payment_intent_id; raise exception 'P2P_ORDER_EXPIRED'; end if;
 update p2p_orders set status='payment_submitted',transfer_reference=trim(p_transfer_reference),payer_note=p_note,submitted_at=now(),updated_at=now() where id=v_order.id;
 update payment_intents set status='processing',provider_reference=trim(p_transfer_reference),provider_payload=coalesce(provider_payload,'{}')||jsonb_build_object('transfer_reference_submitted',true),updated_at=now() where id=v_order.payment_intent_id and status='created';
 update payment_attempts set status='processing',provider_reference=trim(p_transfer_reference),updated_at=now() where payment_intent_id=v_order.payment_intent_id and attempt_number=1;
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id,metadata) values(v_order.id,'p2p.payment.submitted','payment_pending','payment_submitted',auth.uid(),jsonb_build_object('has_reference',true));
 return v_order.id;
end $$;

create or replace function public.confirm_p2p_payment_received(p_p2p_order_id uuid,p_note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_order p2p_orders%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_order from p2p_orders where id=p_p2p_order_id for update;
 if not found or not exists(select 1 from p2p_beneficiaries b where b.id=v_order.beneficiary_id and b.user_id=auth.uid()) then raise exception 'FORBIDDEN'; end if;
 if v_order.status<>'payment_submitted' then raise exception 'INVALID_P2P_STATUS'; end if;
 update p2p_orders set status='under_review',beneficiary_note=p_note,updated_at=now() where id=v_order.id;
 update payment_intents set status='processing',provider_payload=coalesce(provider_payload,'{}')||jsonb_build_object('beneficiary_confirmed',true),updated_at=now() where id=v_order.payment_intent_id and status='processing';
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id,metadata) values(v_order.id,'p2p.payment.received','payment_submitted','under_review',auth.uid(),jsonb_build_object('requires_admin_review',true));
 return v_order.id;
end $$;

create or replace function public.admin_complete_p2p_order(p_p2p_order_id uuid,p_note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_order p2p_orders%rowtype; v_intent payment_intents%rowtype;
begin
 if auth.uid() is null or not(public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role)) then raise exception 'ADMIN_REQUIRED'; end if;
 select * into v_order from p2p_orders where id=p_p2p_order_id for update;
 if not found or v_order.status not in ('payment_detected','under_review') then raise exception 'INVALID_P2P_STATUS'; end if;
 select * into v_intent from payment_intents where id=v_order.payment_intent_id for update;
 if not found or v_intent.amount<>v_order.amount or v_intent.currency<>v_order.currency or v_intent.status<>'processing' then raise exception 'PAYMENT_NOT_READY_FOR_REVIEW'; end if;
 update payment_intents set status='succeeded',succeeded_at=now(),completed_at=now(),updated_at=now() where id=v_intent.id;
 update payment_attempts set status='succeeded',completed_at=now(),updated_at=now() where payment_intent_id=v_intent.id and attempt_number=1;
 update pre_orders set payment_status='paid',updated_at=now() where id=v_order.pre_order_id and payment_status<>'paid';
 if not found then raise exception 'PRE_ORDER_PAYMENT_UPDATE_FAILED'; end if;
 update p2p_orders set status='completed',completed_at=now(),beneficiary_note=coalesce(p_note,beneficiary_note),updated_at=now() where id=v_order.id;
 update p2p_beneficiaries set completed_count=completed_count+1,updated_at=now() where id=v_order.beneficiary_id;
 update p2p_reputation set completed_count=completed_count+1,score=least(100,score+1),updated_at=now() where beneficiary_id=v_order.beneficiary_id;
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id,metadata) values(v_order.id,'p2p.order.completed',v_order.status,'completed',auth.uid(),jsonb_build_object('payment_intent_id',v_intent.id,'pre_order_id',v_order.pre_order_id));
 return v_order.id;
end $$;

create or replace function public.expire_p2p_orders() returns integer
language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
 update p2p_orders set status='expired',updated_at=now() where status in ('matching','offered','payment_pending') and expires_at<=now();
 get diagnostics v_count=row_count;
 update payment_intents pi set status='expired',failure_code='P2P_ORDER_EXPIRED',updated_at=now()
 where pi.id in (select payment_intent_id from p2p_orders where status='expired' and updated_at>=now()-interval '10 minutes') and pi.status not in ('succeeded','refunded','expired');
 return v_count;
end $$;

revoke all on function public.expire_p2p_orders() from public,anon,authenticated;
grant execute on function public.create_p2p_order(uuid,text) to authenticated;
grant execute on function public.submit_p2p_payment_proof(uuid,text,text) to authenticated;
grant execute on function public.confirm_p2p_payment_received(uuid,text) to authenticated;
grant execute on function public.admin_complete_p2p_order(uuid,text) to authenticated;

do $$
begin
 if exists(select 1 from cron.job where jobname='agrilink-expire-p2p-orders') then
   perform cron.unschedule(jobid) from cron.job where jobname='agrilink-expire-p2p-orders';
 end if;
 perform cron.schedule('agrilink-expire-p2p-orders','* * * * *','select public.expire_p2p_orders();');
end $$;