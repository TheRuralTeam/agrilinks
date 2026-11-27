-- Administrative lifecycle for official AgriLink payment destinations.
alter table public.payment_authorized_recipients
  add column if not exists bank_name text,
  add column if not exists sort_order integer not null default 100,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id);

alter table public.payment_authorized_recipients
  add constraint payment_authorized_recipients_bank_name_length
  check (bank_name is null or length(btrim(bank_name)) between 2 and 120) not valid;

create index if not exists payment_authorized_recipients_active_order_idx
  on public.payment_authorized_recipients(active, verified_at, sort_order, created_at)
  where archived_at is null;
create unique index if not exists payment_authorized_recipients_live_account_uidx
  on public.payment_authorized_recipients(channel, account_identifier)
  where archived_at is null;

alter table public.payment_authorized_recipients enable row level security;
revoke all on public.payment_authorized_recipients from anon, authenticated;

create or replace function public.admin_list_payment_recipients()
returns table(id uuid,display_name text,channel text,bank_name text,account_identifier text,account_holder text,instructions text,currency text,active boolean,verified_at timestamptz,verified_by uuid,max_amount numeric,sort_order integer,archived_at timestamptz,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then
  raise exception 'ADMIN_REQUIRED' using errcode='42501';
 end if;
 return query select r.id,r.display_name,r.channel,r.bank_name,r.account_identifier,r.account_holder,r.instructions,r.currency,r.active,r.verified_at,r.verified_by,r.max_amount,r.sort_order,r.archived_at,r.created_at,r.updated_at
 from public.payment_authorized_recipients r order by (r.archived_at is not null),r.sort_order,r.created_at desc;
end $$;

create or replace function public.admin_create_payment_recipient(p_display_name text,p_channel text,p_account_identifier text,p_account_holder text,p_bank_name text default null,p_instructions text default null,p_max_amount numeric default null,p_sort_order integer default 100)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay') then raise exception 'INVALID_PAYMENT_CHANNEL' using errcode='22023'; end if;
 if nullif(btrim(p_display_name),'') is null or nullif(btrim(p_account_identifier),'') is null or nullif(btrim(p_account_holder),'') is null then raise exception 'ACCOUNT_DATA_REQUIRED' using errcode='22023'; end if;
 if p_max_amount is not null and p_max_amount<=0 then raise exception 'INVALID_MAX_AMOUNT' using errcode='22023'; end if;
 insert into public.payment_authorized_recipients(display_name,channel,account_identifier,account_holder,bank_name,instructions,currency,active,verified_at,verified_by,max_amount,sort_order,updated_by)
 values(btrim(p_display_name),p_channel,btrim(p_account_identifier),btrim(p_account_holder),nullif(btrim(p_bank_name),''),nullif(btrim(p_instructions),''),'AOA',false,null,null,p_max_amount,greatest(p_sort_order,0),auth.uid())
 returning id into v_id;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.created','PAYMENT_RECIPIENT_CREATED',jsonb_build_object('recipient_id',v_id,'channel',p_channel));
 return v_id;
end $$;

create or replace function public.admin_update_payment_recipient(p_recipient_id uuid,p_display_name text,p_channel text,p_account_identifier text,p_account_holder text,p_bank_name text default null,p_instructions text default null,p_max_amount numeric default null,p_sort_order integer default 100)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_before public.payment_authorized_recipients%rowtype; v_sensitive_change boolean;
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay') or nullif(btrim(p_display_name),'') is null or nullif(btrim(p_account_identifier),'') is null or nullif(btrim(p_account_holder),'') is null then raise exception 'INVALID_ACCOUNT_DATA' using errcode='22023'; end if;
 if p_max_amount is not null and p_max_amount<=0 then raise exception 'INVALID_MAX_AMOUNT' using errcode='22023'; end if;
 select * into v_before from public.payment_authorized_recipients where id=p_recipient_id and archived_at is null for update;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 v_sensitive_change := v_before.channel is distinct from p_channel or v_before.account_identifier is distinct from btrim(p_account_identifier) or v_before.account_holder is distinct from btrim(p_account_holder) or v_before.bank_name is distinct from nullif(btrim(p_bank_name),'');
 update public.payment_authorized_recipients set display_name=btrim(p_display_name),channel=p_channel,account_identifier=btrim(p_account_identifier),account_holder=btrim(p_account_holder),bank_name=nullif(btrim(p_bank_name),''),instructions=nullif(btrim(p_instructions),''),max_amount=p_max_amount,sort_order=greatest(p_sort_order,0),active=case when v_sensitive_change then false else active end,verified_at=case when v_sensitive_change then null else verified_at end,verified_by=case when v_sensitive_change then null else verified_by end,updated_by=auth.uid(),updated_at=now() where id=p_recipient_id;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.updated','PAYMENT_RECIPIENT_UPDATED',jsonb_build_object('recipient_id',p_recipient_id,'sensitive_change',v_sensitive_change,'previous_channel',v_before.channel,'new_channel',p_channel));
 return true;
end $$;

create or replace function public.admin_verify_payment_recipient(p_recipient_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 update public.payment_authorized_recipients set verified_at=now(),verified_by=auth.uid(),updated_by=auth.uid(),updated_at=now() where id=p_recipient_id and archived_at is null;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.verified','PAYMENT_RECIPIENT_VERIFIED',jsonb_build_object('recipient_id',p_recipient_id));
 return true;
end $$;

create or replace function public.admin_set_payment_recipient_active(p_recipient_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_active and not exists(select 1 from public.payment_authorized_recipients where id=p_recipient_id and archived_at is null and verified_at is not null) then raise exception 'RECIPIENT_MUST_BE_VERIFIED' using errcode='22023'; end if;
 update public.payment_authorized_recipients set active=p_active,updated_by=auth.uid(),updated_at=now() where id=p_recipient_id and archived_at is null;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),case when p_active then 'payment_recipient.activated' else 'payment_recipient.deactivated' end,case when p_active then 'PAYMENT_RECIPIENT_ACTIVATED' else 'PAYMENT_RECIPIENT_DEACTIVATED' end,jsonb_build_object('recipient_id',p_recipient_id));
 return true;
end $$;

create or replace function public.admin_archive_payment_recipient(p_recipient_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 update public.payment_authorized_recipients set active=false,archived_at=now(),updated_by=auth.uid(),updated_at=now() where id=p_recipient_id and archived_at is null;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.archived','PAYMENT_RECIPIENT_ARCHIVED',jsonb_build_object('recipient_id',p_recipient_id));
 return true;
end $$;

revoke all on function public.admin_list_payment_recipients() from public,anon;
revoke all on function public.admin_create_payment_recipient(text,text,text,text,text,text,numeric,integer) from public,anon;
revoke all on function public.admin_update_payment_recipient(uuid,text,text,text,text,text,text,numeric,integer) from public,anon;
revoke all on function public.admin_verify_payment_recipient(uuid) from public,anon;
revoke all on function public.admin_set_payment_recipient_active(uuid,boolean) from public,anon;
revoke all on function public.admin_archive_payment_recipient(uuid) from public,anon;
grant execute on function public.admin_list_payment_recipients() to authenticated;
grant execute on function public.admin_create_payment_recipient(text,text,text,text,text,text,numeric,integer) to authenticated;
grant execute on function public.admin_update_payment_recipient(uuid,text,text,text,text,text,text,numeric,integer) to authenticated;
grant execute on function public.admin_verify_payment_recipient(uuid) to authenticated;
grant execute on function public.admin_set_payment_recipient_active(uuid,boolean) to authenticated;
grant execute on function public.admin_archive_payment_recipient(uuid) to authenticated;

insert into public.payment_authorized_recipients(display_name,channel,account_identifier,account_holder,bank_name,instructions,currency,active,verified_at,max_amount,sort_order)
select 'Transferência bancária — AgriLink','bank_transfer','0006 0000 10942944301 33','Claúdio Afonso Henriques',null,'Conta registada para recebimentos AgriLink. Confirmar titularidade e autorização antes de ativar.','AOA',false,null,null,10
where not exists(select 1 from public.payment_authorized_recipients where channel='bank_transfer' and regexp_replace(account_identifier,'\\s','','g')='000600001094294430133' and archived_at is null);
