-- QA/security: as transições financeiras e de pedidos devem passar por RPCs
-- autorizadas; o formulário público de contacto já usa submit_public_contact,
-- e as Edge Functions de suporte usam service_role.
-- Mantém SELECT protegido por RLS e a actualização de suporte apenas para os
-- papéis administrativos autorizados pelas políticas existentes.

revoke all on table public.orders from anon;
revoke insert, update, delete on table public.orders from authenticated;
grant select on table public.orders to authenticated;

revoke all on table public.support_messages from anon;
revoke insert, delete on table public.support_messages from authenticated;
