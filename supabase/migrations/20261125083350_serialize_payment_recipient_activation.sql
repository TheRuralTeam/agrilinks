-- Serialize verification state checks with activation to avoid TOCTOU races.
create or replace function public.admin_set_payment_recipient_active(p_recipient_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_recipient public.payment_authorized_recipients%rowtype;
begin
 if auth.uid() is null or not (public.is_root_admin(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 select * into v_recipient from public.payment_authorized_recipients where id=p_recipient_id and archived_at is null for update;
 if not found then raise exception 'PAYMENT_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
 if p_active and v_recipient.verified_at is null then raise exception 'RECIPIENT_MUST_BE_VERIFIED' using errcode='22023'; end if;
 update public.payment_authorized_recipients set active=p_active,updated_by=auth.uid(),updated_at=now() where id=p_recipient_id and archived_at is null;
 insert into public.audit_logs(user_id,action,event_type,details) values(auth.uid(),case when p_active then 'payment_recipient.activated' else 'payment_recipient.deactivated' end,case when p_active then 'PAYMENT_RECIPIENT_ACTIVATED' else 'PAYMENT_RECIPIENT_DEACTIVATED' end,jsonb_build_object('recipient_id',p_recipient_id));
 return true;
end $$;
revoke all on function public.admin_set_payment_recipient_active(uuid,boolean) from public,anon;
grant execute on function public.admin_set_payment_recipient_active(uuid,boolean) to authenticated;
