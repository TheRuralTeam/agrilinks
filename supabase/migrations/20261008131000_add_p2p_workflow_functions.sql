-- Funções transacionais do módulo P2P AgriLink.
create or replace function public.submit_p2p_beneficiary_application(p_legal_name text,p_phone text,p_requested_channels text[],p_notes text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if nullif(trim(p_legal_name),'') is null then raise exception 'LEGAL_NAME_REQUIRED'; end if;
 if coalesce(array_length(p_requested_channels,1),0)=0 then raise exception 'PAYMENT_CHANNEL_REQUIRED'; end if;
 if exists(select 1 from p2p_beneficiary_applications where user_id=auth.uid() and status in ('pending','under_review')) then raise exception 'APPLICATION_ALREADY_PENDING'; end if;
 insert into p2p_beneficiary_applications(user_id,legal_name,phone,requested_channels,notes) values(auth.uid(),trim(p_legal_name),nullif(trim(p_phone),''),p_requested_channels,p_notes) returning id into v_id;
 return v_id;
end $$;

create or replace function public.admin_review_p2p_beneficiary_application(p_application_id uuid,p_decision text,p_reason text default null,p_per_transaction numeric default 0,p_daily numeric default 0,p_monthly numeric default 0,p_simultaneous integer default 3) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_app p2p_beneficiary_applications%rowtype; v_beneficiary uuid;
begin
 if auth.uid() is null or not(public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role)) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_decision not in ('approved','rejected','under_review','suspended') then raise exception 'INVALID_DECISION'; end if;
 if p_per_transaction<0 or p_daily<0 or p_monthly<0 or p_simultaneous<1 then raise exception 'INVALID_LIMITS'; end if;
 select * into v_app from p2p_beneficiary_applications where id=p_application_id for update;
 if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
 update p2p_beneficiary_applications set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_decision='rejected' then nullif(trim(p_reason),'') else null end,updated_at=now() where id=p_application_id;
 if p_decision='approved' then
   insert into p2p_beneficiaries(user_id,application_id,status,verified_at,verified_by,approved_at,approved_by,per_transaction_limit,daily_limit,monthly_limit,simultaneous_limit,availability_status)
   values(v_app.user_id,v_app.id,'active',now(),auth.uid(),now(),auth.uid(),p_per_transaction,p_daily,p_monthly,p_simultaneous,'offline')
   on conflict(user_id) do update set status='active',application_id=excluded.application_id,verified_at=now(),verified_by=auth.uid(),approved_at=now(),approved_by=auth.uid(),per_transaction_limit=excluded.per_transaction_limit,daily_limit=excluded.daily_limit,monthly_limit=excluded.monthly_limit,simultaneous_limit=excluded.simultaneous_limit,updated_at=now()
   returning id into v_beneficiary;
   insert into p2p_limits(beneficiary_id,per_transaction,daily,monthly,simultaneous,updated_by) values(v_beneficiary,p_per_transaction,p_daily,p_monthly,p_simultaneous,auth.uid())
   on conflict(beneficiary_id) do update set per_transaction=excluded.per_transaction,daily=excluded.daily,monthly=excluded.monthly,simultaneous=excluded.simultaneous,updated_by=auth.uid(),updated_at=now();
   insert into p2p_reputation(beneficiary_id) values(v_beneficiary) on conflict(beneficiary_id) do nothing;
 else
   select id into v_beneficiary from p2p_beneficiaries where user_id=v_app.user_id;
   if v_beneficiary is not null and p_decision='suspended' then update p2p_beneficiaries set status='suspended',updated_at=now() where id=v_beneficiary; end if;
 end if;
 insert into p2p_audit_logs(beneficiary_id,actor_id,action,metadata) values(v_beneficiary,auth.uid(),'beneficiary.application.reviewed',jsonb_build_object('application_id',p_application_id,'decision',p_decision,'reason',p_reason));
 return v_beneficiary;
end $$;

create or replace function public.admin_add_p2p_beneficiary_account(p_beneficiary_id uuid,p_channel text,p_account_identifier text,p_account_holder text,p_instructions text default null,p_max_amount numeric default 0) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null or not(public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role)) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay') then raise exception 'INVALID_PAYMENT_CHANNEL'; end if;
 if nullif(trim(p_account_identifier),'') is null or nullif(trim(p_account_holder),'') is null then raise exception 'ACCOUNT_DATA_REQUIRED'; end if;
 if p_max_amount<0 then raise exception 'INVALID_MAX_AMOUNT'; end if;
 insert into p2p_beneficiary_accounts(beneficiary_id,channel,account_identifier,account_holder,instructions,max_amount,active,verified_at,verified_by)
 values(p_beneficiary_id,p_channel,trim(p_account_identifier),trim(p_account_holder),p_instructions,p_max_amount,true,now(),auth.uid()) returning id into v_id;
 insert into p2p_audit_logs(beneficiary_id,actor_id,action,metadata) values(p_beneficiary_id,auth.uid(),'beneficiary.account.added',jsonb_build_object('account_id',v_id,'channel',p_channel));
 return v_id;
end $$;

create or replace function public.create_p2p_order(p_pre_order_id uuid,p_payment_channel text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_order_id uuid; v_buyer uuid; v_amount numeric; v_payment_status text; v_count integer:=0; v_b record;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_payment_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay') then raise exception 'INVALID_PAYMENT_CHANNEL'; end if;
 select buyer_id,total_price,payment_status into v_buyer,v_amount,v_payment_status from pre_orders where id=p_pre_order_id and status='accepted' for update;
 if v_buyer<>auth.uid() then raise exception 'FORBIDDEN'; end if;
 if v_amount is null or v_amount<=0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
 if coalesce((select payment_status from pre_orders where id=p_pre_order_id),'unpaid')='paid' then raise exception 'ALREADY_PAID'; end if;
 if exists(select 1 from p2p_orders where pre_order_id=p_pre_order_id and status not in ('cancelled','expired','rejected','refunded')) then raise exception 'P2P_ORDER_ALREADY_EXISTS'; end if;
 insert into p2p_orders(buyer_id,pre_order_id,amount,currency,payment_channel,status,expires_at) values(auth.uid(),p_pre_order_id,v_amount,'AOA',p_payment_channel,'matching',now()+interval '15 minutes') returning id into v_order_id;
 for v_b in
   select b.id beneficiary_id,coalesce(r.score,0) score,b.completion_rate,b.average_completion_seconds
   from p2p_beneficiaries b join p2p_beneficiary_accounts a on a.beneficiary_id=b.id and a.channel=p_payment_channel and a.active and a.verified_at is not null
   left join p2p_reputation r on r.beneficiary_id=b.id
   where b.status='active' and b.availability_status='online' and b.user_id<>auth.uid()
     and (b.per_transaction_limit=0 or b.per_transaction_limit>=v_amount) and (a.max_amount=0 or a.max_amount>=v_amount)
     and (select count(*) from p2p_orders o where o.beneficiary_id=b.id and o.status in ('accepted','payment_pending','payment_submitted','payment_detected','under_review'))<b.simultaneous_limit
   order by coalesce(r.score,0) desc,b.completion_rate desc,b.average_completion_seconds asc,b.updated_at asc limit 5
 loop
   insert into p2p_matches(p2p_order_id,beneficiary_id,score) values(v_order_id,v_b.beneficiary_id,(v_b.score*0.7)+(v_b.completion_rate*0.3)); v_count:=v_count+1;
 end loop;
 if v_count>0 then update p2p_orders set status='offered',updated_at=now() where id=v_order_id; end if;
 insert into p2p_transaction_events(p2p_order_id,event_type,to_status,actor_id,metadata) values(v_order_id,'p2p.order.created',case when v_count>0 then 'offered' else 'matching' end,auth.uid(),jsonb_build_object('matches',v_count,'channel',p_payment_channel));
 return v_order_id;
end $$;

create or replace function public.accept_p2p_match(p_match_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_match p2p_matches%rowtype; v_order p2p_orders%rowtype; v_b p2p_beneficiaries%rowtype; v_account uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_match from p2p_matches where id=p_match_id for update;
 if not found then raise exception 'MATCH_NOT_FOUND'; end if;
 select * into v_order from p2p_orders where id=v_match.p2p_order_id for update;
 select * into v_b from p2p_beneficiaries where id=v_match.beneficiary_id for update;
 if v_b.user_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
 if v_match.status<>'offered' or v_order.status not in ('offered','matching') then raise exception 'MATCH_NO_LONGER_AVAILABLE'; end if;
 if v_order.expires_at<=now() then update p2p_orders set status='expired',updated_at=now() where id=v_order.id; raise exception 'P2P_ORDER_EXPIRED'; end if;
 if v_b.status<>'active' then raise exception 'BENEFICIARY_NOT_ACTIVE'; end if;
 if (select count(*) from p2p_orders o where o.beneficiary_id=v_b.id and o.status in ('accepted','payment_pending','payment_submitted','payment_detected','under_review'))>=v_b.simultaneous_limit then raise exception 'BENEFICIARY_LIMIT_REACHED'; end if;
 select a.id into v_account from p2p_beneficiary_accounts a where a.beneficiary_id=v_b.id and a.channel=v_order.payment_channel and a.active and a.verified_at is not null and (a.max_amount=0 or a.max_amount>=v_order.amount) order by a.updated_at desc limit 1;
 if v_account is null then raise exception 'BENEFICIARY_ACCOUNT_UNAVAILABLE'; end if;
 update p2p_matches set status='accepted',responded_at=now() where id=v_match.id;
 update p2p_matches set status='expired',responded_at=now() where p2p_order_id=v_order.id and id<>v_match.id and status='offered';
 update p2p_orders set beneficiary_id=v_b.id,beneficiary_account_id=v_account,status='payment_pending',accepted_at=now(),updated_at=now() where id=v_order.id;
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id,metadata) values(v_order.id,'p2p.match.accepted',v_order.status,'payment_pending',auth.uid(),jsonb_build_object('beneficiary_id',v_b.id,'match_id',v_match.id,'account_id',v_account));
 return v_order.id;
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
 if v_order.expires_at<=now() then update p2p_orders set status='expired',updated_at=now() where id=v_order.id; raise exception 'P2P_ORDER_EXPIRED'; end if;
 update p2p_orders set status='payment_submitted',transfer_reference=trim(p_transfer_reference),payer_note=p_note,submitted_at=now(),updated_at=now() where id=v_order.id;
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id) values(v_order.id,'p2p.payment.submitted','payment_pending','payment_submitted',auth.uid());
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
 update p2p_orders set status='payment_detected',beneficiary_note=p_note,updated_at=now() where id=v_order.id;
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id) values(v_order.id,'p2p.payment.received','payment_submitted','payment_detected',auth.uid());
 return v_order.id;
end $$;

create or replace function public.admin_complete_p2p_order(p_p2p_order_id uuid,p_note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_order p2p_orders%rowtype;
begin
 if auth.uid() is null or not(public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role)) then raise exception 'ADMIN_REQUIRED'; end if;
 select * into v_order from p2p_orders where id=p_p2p_order_id for update;
 if not found or v_order.status not in ('payment_detected','under_review') then raise exception 'INVALID_P2P_STATUS'; end if;
 update p2p_orders set status='completed',completed_at=now(),beneficiary_note=coalesce(p_note,beneficiary_note),updated_at=now() where id=v_order.id;
 update p2p_beneficiaries set completed_count=completed_count+1,updated_at=now() where id=v_order.beneficiary_id;
 update p2p_reputation set completed_count=completed_count+1,score=least(100,score+1),updated_at=now() where beneficiary_id=v_order.beneficiary_id;
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id) values(v_order.id,'p2p.order.completed',v_order.status,'completed',auth.uid());
 return v_order.id;
end $$;

create or replace function public.open_p2p_dispute(p_p2p_order_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_order p2p_orders%rowtype; v_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'DISPUTE_REASON_REQUIRED'; end if;
 select * into v_order from p2p_orders where id=p_p2p_order_id for update;
 if not found then raise exception 'P2P_ORDER_NOT_FOUND'; end if;
 if v_order.buyer_id<>auth.uid() and not exists(select 1 from p2p_beneficiaries b where b.id=v_order.beneficiary_id and b.user_id=auth.uid()) then raise exception 'FORBIDDEN'; end if;
 if v_order.status not in ('payment_submitted','payment_detected','under_review','completed') then raise exception 'INVALID_P2P_STATUS'; end if;
 insert into p2p_disputes(p2p_order_id,opened_by,reason) values(v_order.id,auth.uid(),trim(p_reason)) returning id into v_id;
 update p2p_orders set status='disputed',updated_at=now() where id=v_order.id;
 insert into p2p_transaction_events(p2p_order_id,event_type,from_status,to_status,actor_id,metadata) values(v_order.id,'p2p.dispute.opened',v_order.status,'disputed',auth.uid(),jsonb_build_object('dispute_id',v_id));
 return v_id;
end $$;

revoke all on function public.submit_p2p_beneficiary_application(text,text,text[],text) from public,anon;
revoke all on function public.admin_review_p2p_beneficiary_application(uuid,text,text,numeric,numeric,numeric,integer) from public,anon,authenticated;
revoke all on function public.admin_add_p2p_beneficiary_account(uuid,text,text,text,text,numeric) from public,anon,authenticated;
revoke all on function public.create_p2p_order(uuid,text) from public,anon;
revoke all on function public.accept_p2p_match(uuid) from public,anon;
revoke all on function public.submit_p2p_payment_proof(uuid,text,text) from public,anon;
revoke all on function public.confirm_p2p_payment_received(uuid,text) from public,anon;
revoke all on function public.admin_complete_p2p_order(uuid,text) from public,anon,authenticated;
revoke all on function public.open_p2p_dispute(uuid,text) from public,anon;
grant execute on function public.submit_p2p_beneficiary_application(text,text,text[],text) to authenticated;
grant execute on function public.admin_review_p2p_beneficiary_application(uuid,text,text,numeric,numeric,numeric,integer) to authenticated;
grant execute on function public.admin_add_p2p_beneficiary_account(uuid,text,text,text,text,numeric) to authenticated;
grant execute on function public.create_p2p_order(uuid,text) to authenticated;
grant execute on function public.accept_p2p_match(uuid) to authenticated;
grant execute on function public.submit_p2p_payment_proof(uuid,text,text) to authenticated;
grant execute on function public.confirm_p2p_payment_received(uuid,text) to authenticated;
grant execute on function public.admin_complete_p2p_order(uuid,text) to authenticated;
grant execute on function public.open_p2p_dispute(uuid,text) to authenticated;
