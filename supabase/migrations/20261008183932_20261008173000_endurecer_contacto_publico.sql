-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008183932; original ledger name: 20261008173000_endurecer_contacto_publico.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

create or replace function public.submit_public_contact(p_name text,p_email text,p_phone text,p_message text)
returns uuid
language plpgsql security definer set search_path='public'
as $function$
declare
 v_name text:=btrim(coalesce(p_name,''));
 v_email text:=lower(btrim(coalesce(p_email,'')));
 v_phone text:=nullif(btrim(coalesce(p_phone,'')),'');
 v_message text:=btrim(coalesce(p_message,''));
 v_user_id uuid:=auth.uid();
 v_id uuid;
 v_headers jsonb;
 v_ip text;
 v_bucket text;
 v_now timestamptz:=now();
 v_count integer;
begin
 if length(v_name)<2 or length(v_name)>120 then raise exception 'CONTACT_NAME_INVALID' using errcode='22023'; end if;
 if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,}$' or length(v_email)>254 then raise exception 'CONTACT_EMAIL_INVALID' using errcode='22023'; end if;
 if length(v_message)<5 or length(v_message)>5000 then raise exception 'CONTACT_MESSAGE_INVALID' using errcode='22023'; end if;
 if v_phone is not null and length(v_phone)>40 then raise exception 'CONTACT_PHONE_INVALID' using errcode='22023'; end if;
 begin v_headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then v_headers:=null; end;
 v_ip:=coalesce(v_headers->>'cf-connecting-ip',split_part(coalesce(v_headers->>'x-forwarded-for',''),',',1),v_headers->>'x-real-ip');
 if v_ip is not null and btrim(v_ip)<>'' then
   v_bucket:='contact:ip:'||md5(btrim(v_ip));
   insert into public.api_rate_limits(bucket_key,window_started,request_count,updated_at)
   values(v_bucket,v_now,1,v_now)
   on conflict(bucket_key) do update set
     request_count=case when public.api_rate_limits.window_started<=v_now-interval '15 minutes' then 1 else public.api_rate_limits.request_count+1 end,
     window_started=case when public.api_rate_limits.window_started<=v_now-interval '15 minutes' then v_now else public.api_rate_limits.window_started end,
     updated_at=v_now;
   select request_count into v_count from public.api_rate_limits where bucket_key=v_bucket;
   if v_count>10 then raise exception 'CONTACT_RATE_LIMITED' using errcode='42900'; end if;
 end if;
 if exists(select 1 from public.support_messages where lower(email)=v_email and created_at>v_now-interval '10 minutes') then
   raise exception 'CONTACT_RATE_LIMITED' using errcode='42900';
 end if;
 insert into public.support_messages(user_id,name,email,phone,message,status)
 values(v_user_id,v_name,v_email,v_phone,v_message,'pendente') returning id into v_id;
 return v_id;
end;
$function$;
