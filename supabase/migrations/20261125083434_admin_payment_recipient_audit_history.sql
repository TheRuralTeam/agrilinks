-- Read-only administrative audit history for payment destination changes.
create or replace function public.admin_list_payment_recipient_audit(p_recipient_id uuid default null,p_limit integer default 50)
returns table(id uuid,actor_id uuid,actor_name text,action text,event_type text,occurred_at timestamptz,details jsonb)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return query select al.id,al.user_id,coalesce(u.full_name,'Administrador'),al.action,al.event_type,coalesce(al.log_time,now()),al.details
 from public.audit_logs al left join public.users u on u.id=al.user_id
 where al.event_type like 'PAYMENT_RECIPIENT_%' and (p_recipient_id is null or al.details->>'recipient_id'=p_recipient_id::text)
 order by al.log_time desc nulls last limit greatest(1,least(coalesce(p_limit,50),200));
end $$;
revoke all on function public.admin_list_payment_recipient_audit(uuid,integer) from public,anon;
grant execute on function public.admin_list_payment_recipient_audit(uuid,integer) to authenticated;
