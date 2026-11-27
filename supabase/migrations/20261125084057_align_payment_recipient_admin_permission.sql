-- Use the same explicit Admin Console permission as the UI, not only the app_role=admin flag.
create or replace function public.admin_list_payment_recipients()
returns table(id uuid,display_name text,channel text,bank_name text,account_identifier text,account_holder text,instructions text,currency text,active boolean,verified_at timestamptz,verified_by uuid,max_amount numeric,sort_order integer,archived_at timestamptz,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.has_admin_permission(auth.uid(),'manage_admins'::public.admin_permission) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return query select r.id,r.display_name,r.channel,r.bank_name,r.account_identifier,r.account_holder,r.instructions,r.currency,r.active,r.verified_at,r.verified_by,r.max_amount,r.sort_order,r.archived_at,r.created_at,r.updated_at
 from public.payment_authorized_recipients r order by (r.archived_at is not null),r.sort_order,r.created_at desc;
end $$;

create or replace function public.admin_create_payment_recipient(p_display_name text,p_channel text,p_account_identifier text,p_account_holder text,p_bank_name text default null,p_instructions text default null,p_max_amount numeric default null,p_sort_order integer default 100)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.has_admin_permission(auth.uid(),'manage_admins'::public.admin_permission) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay') then raise exception 'INVALID_PAYMENT_CHANNEL' using errcode='22023'; end if;
 if nullif(btrim(p_display_name),'') is null or nullif(btrim(p_account_identifier),'') is null or nullif(btrim(p_account_holder),'') is null then raise exception 'ACCOUNT_DATA_REQUIRED' using errcode='22023'; end if;
 if p_max_amount is not null and p_max_amount<=0 then raise exception 'INVALID_MAX_AMOUNT' using errcode='22023'; end if;
 insert into public.payment_authorized_recipients(display_name,channel,account_identifier,account_holder,bank_name,instructions,currency,active,verified_at,verified_by,max_amount,sort_order,updated_by)
 values(btrim(p_display_name),p_channel,btrim(p_account_identifier),btrim(p_account_holder),nullif(btrim(p_bank_name),''),nullif(btrim(p_instructions),''),'AOA',false,null,null,p_max_amount,greatest(p_sort_order,0),auth.uid()) returning id into v_id;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.created','PAYMENT_RECIPIENT_CREATED',jsonb_build_object('recipient_id',v_id,'channel',p_channel));
 return v_id;
end $$;

create or replace function public.admin_update_payment_recipient(p_recipient_id uuid,p_display_name text,p_channel text,p_account_identifier text,p_account_holder text,p_bank_name text default null,p_instructions text default null,p_max_amount numeric default null,p_sort_order integer default 100)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_before public.payment_authorized_recipients%rowtype; v_sensitive_change boolean;
begin
 if auth.uid() is null or not public.has_admin_permission(auth.uid(),'manage_admins'::public.admin_permission) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_channel not in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay') or nullif(btrim(p_display_name),'') is null or nullif(btrim(p_account_identifier),'') is null or nullif(btrim(p_account_holder),'') is null then raise exception 'INVALID_ACCOUNT_DATA' using errcode='22023'; end if;
 if p_max_amount is not null and p_max_amount<=0 then raise exception 'INVALID_MAX_AMOUNT' using errcode='22023'; end if;
 select * into v_before from public.payment_authorized_recipients where id=p_recipient_id and archived_at is null for update;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 v_sensitive_change:=v_before.channel is distinct from p_channel or v_before.account_identifier is distinct from btrim(p_account_identifier) or v_before.account_holder is distinct from btrim(p_account_holder) or v_before.bank_name is distinct from nullif(btrim(p_bank_name),'');
 update public.payment_authorized_recipients set display_name=btrim(p_display_name),channel=p_channel,account_identifier=btrim(p_account_identifier),account_holder=btrim(p_account_holder),bank_name=nullif(btrim(p_bank_name),''),instructions=nullif(btrim(p_instructions),''),max_amount=p_max_amount,sort_order=greatest(p_sort_order,0),active=case when v_sensitive_change then false else active end,verified_at=case when v_sensitive_change then null else verified_at end,verified_by=case when v_sensitive_change then null else verified_by end,updated_by=auth.uid(),updated_at=now() where id=p_recipient_id;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.updated','PAYMENT_RECIPIENT_UPDATED',jsonb_build_object('recipient_id',p_recipient_id,'sensitive_change',v_sensitive_change,'previous_channel',v_before.channel,'new_channel',p_channel));
 return true;
end $$;

create or replace function public.admin_verify_payment_recipient(p_recipient_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.has_admin_permission(auth.uid(),'manage_admins'::public.admin_permission) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 update public.payment_authorized_recipients set verified_at=now(),verified_by=auth.uid(),updated_by=auth.uid(),updated_at=now() where id=p_recipient_id and archived_at is null;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.verified','PAYMENT_RECIPIENT_VERIFIED',jsonb_build_object('recipient_id',p_recipient_id));
 return true;
end $$;

create or replace function public.admin_set_payment_recipient_active(p_recipient_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_recipient public.payment_authorized_recipients%rowtype;
begin
 if auth.uid() is null or not public.has_admin_permission(auth.uid(),'manage_admins'::public.admin_permission) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 select * into v_recipient from public.payment_authorized_recipients where id=p_recipient_id and archived_at is null for update;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 if p_active and v_recipient.verified_at is null then raise exception 'RECIPIENT_MUST_BE_VERIFIED' using errcode='22023'; end if;
 update public.payment_authorized_recipients set active=p_active,updated_by=auth.uid(),updated_at=now() where id=p_recipient_id and archived_at is null;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),case when p_active then 'payment_recipient.activated' else 'payment_recipient.deactivated' end,case when p_active then 'PAYMENT_RECIPIENT_ACTIVATED' else 'PAYMENT_RECIPIENT_DEACTIVATED' end,jsonb_build_object('recipient_id',p_recipient_id));
 return true;
end $$;

create or replace function public.admin_archive_payment_recipient(p_recipient_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.has_admin_permission(auth.uid(),'manage_admins'::public.admin_permission) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 update public.payment_authorized_recipients set active=false,archived_at=now(),updated_by=auth.uid(),updated_at=now() where id=p_recipient_id and archived_at is null;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),'payment_recipient.archived','PAYMENT_RECIPIENT_ARCHIVED',jsonb_build_object('recipient_id',p_recipient_id));
 return true;
end $$;

create or replace function public.admin_list_payment_recipient_audit(p_recipient_id uuid default null,p_limit integer default 50)
returns table(id uuid,actor_id uuid,actor_name text,action text,event_type text,occurred_at timestamptz,details jsonb)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.has_admin_permission(auth.uid(),'manage_admins'::public.admin_permission) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return query select al.id,al.user_id,coalesce(u.full_name,'Administrador'),al.action,al.event_type,coalesce(al.log_time,now()),al.details
 from public.audit_logs al left join public.users u on u.id=al.user_id
 where al.event_type like 'PAYMENT_RECIPIENT_%' and (p_recipient_id is null or al.details->>'recipient_id'=p_recipient_id::text)
 order by al.log_time desc nulls last limit greatest(1,least(coalesce(p_limit,50),200));
end $$;
