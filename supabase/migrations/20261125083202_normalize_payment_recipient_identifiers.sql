-- Prevent duplicate payment destinations even when spaces or letter case differ.
drop index if exists public.payment_authorized_recipients_live_account_uidx;
create unique index payment_authorized_recipients_live_account_uidx
on public.payment_authorized_recipients(channel, upper(regexp_replace(account_identifier,'[[:space:]]','','g')))
where archived_at is null;
