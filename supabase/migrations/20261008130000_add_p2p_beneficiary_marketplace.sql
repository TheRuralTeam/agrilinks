-- P2P AgriLink: beneficiários oficiais, matching, provas, disputas e auditoria
-- Aplicar apenas em ambiente controlado; as funções exigem utilizador autenticado e verificações administrativas.

create table if not exists public.p2p_beneficiary_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','under_review','approved','rejected','suspended')),
  legal_name text not null, phone text, requested_channels text[] not null default '{}', notes text,
  reviewed_by uuid references public.users(id), reviewed_at timestamptz, rejection_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists ux_p2p_application_active on public.p2p_beneficiary_applications(user_id) where status in ('pending','under_review');

create table if not exists public.p2p_beneficiaries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.users(id) on delete restrict,
  application_id uuid references public.p2p_beneficiary_applications(id),
  status text not null default 'pending' check (status in ('pending','active','paused','suspended','revoked')),
  verified_at timestamptz, verified_by uuid references public.users(id), approved_at timestamptz, approved_by uuid references public.users(id),
  daily_limit numeric(15,2) not null default 0 check (daily_limit>=0), monthly_limit numeric(15,2) not null default 0 check (monthly_limit>=0),
  per_transaction_limit numeric(15,2) not null default 0 check (per_transaction_limit>=0), simultaneous_limit integer not null default 3 check (simultaneous_limit between 1 and 100),
  availability_status text not null default 'offline' check (availability_status in ('online','busy','offline')),
  completion_rate numeric(5,2) not null default 0 check (completion_rate between 0 and 100),
  completed_count integer not null default 0 check (completed_count>=0), cancelled_count integer not null default 0 check (cancelled_count>=0),
  dispute_count integer not null default 0 check (dispute_count>=0), average_completion_seconds integer not null default 0 check (average_completion_seconds>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.p2p_beneficiary_accounts (
  id uuid primary key default gen_random_uuid(), beneficiary_id uuid not null references public.p2p_beneficiaries(id) on delete cascade,
  channel text not null check (channel in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay')),
  account_identifier text not null, account_holder text not null, currency char(3) not null default 'AOA',
  instructions text, max_amount numeric(15,2) not null default 0 check (max_amount>=0), active boolean not null default false,
  verified_at timestamptz, verified_by uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(beneficiary_id,channel,account_identifier)
);

create table if not exists public.p2p_orders (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.users(id), pre_order_id uuid references public.pre_orders(id),
  payment_intent_id uuid references public.payment_intents(id), beneficiary_id uuid references public.p2p_beneficiaries(id),
  beneficiary_account_id uuid references public.p2p_beneficiary_accounts(id), amount numeric(15,2) not null check (amount>0), currency char(3) not null default 'AOA',
  payment_channel text not null check (payment_channel in ('bank_transfer','multicaixa_express','unitel_money','afrimoney','paypay')),
  status text not null default 'created' check (status in ('created','matching','offered','accepted','payment_pending','payment_submitted','payment_detected','under_review','completed','expired','cancelled','rejected','disputed','refunded')),
  transfer_reference text, payer_note text, beneficiary_note text, expires_at timestamptz not null, accepted_at timestamptz, submitted_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists ux_p2p_order_payment_intent on public.p2p_orders(payment_intent_id) where payment_intent_id is not null;
create index if not exists ix_p2p_orders_buyer_status on public.p2p_orders(buyer_id,status);
create index if not exists ix_p2p_orders_beneficiary_status on public.p2p_orders(beneficiary_id,status);

create table if not exists public.p2p_matches (
  id uuid primary key default gen_random_uuid(), p2p_order_id uuid not null references public.p2p_orders(id) on delete cascade,
  beneficiary_id uuid not null references public.p2p_beneficiaries(id) on delete restrict, score numeric(8,3) not null default 0,
  status text not null default 'offered' check (status in ('offered','accepted','rejected','expired','cancelled')),
  offered_at timestamptz not null default now(), responded_at timestamptz, created_at timestamptz not null default now(), unique(p2p_order_id,beneficiary_id)
);

create table if not exists public.p2p_transaction_events (
  id uuid primary key default gen_random_uuid(), p2p_order_id uuid not null references public.p2p_orders(id) on delete cascade,
  event_type text not null, from_status text, to_status text, actor_id uuid references public.users(id), metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create table if not exists public.p2p_disputes (
  id uuid primary key default gen_random_uuid(), p2p_order_id uuid not null references public.p2p_orders(id) on delete restrict,
  opened_by uuid not null references public.users(id), reason text not null,
  status text not null default 'open' check (status in ('open','under_review','resolved_buyer','resolved_beneficiary','cancelled')),
  resolution_note text, resolved_by uuid references public.users(id), resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists ux_p2p_open_dispute on public.p2p_disputes(p2p_order_id) where status in ('open','under_review');

create table if not exists public.p2p_limits (
  id uuid primary key default gen_random_uuid(), beneficiary_id uuid not null unique references public.p2p_beneficiaries(id) on delete cascade,
  per_transaction numeric(15,2) not null default 0 check (per_transaction>=0), daily numeric(15,2) not null default 0 check (daily>=0),
  monthly numeric(15,2) not null default 0 check (monthly>=0), simultaneous integer not null default 3 check (simultaneous between 1 and 100),
  updated_by uuid references public.users(id), updated_at timestamptz not null default now()
);

create table if not exists public.p2p_reputation (
  id uuid primary key default gen_random_uuid(), beneficiary_id uuid not null unique references public.p2p_beneficiaries(id) on delete cascade,
  score numeric(5,2) not null default 0 check (score between 0 and 100), completed_count integer not null default 0 check (completed_count>=0),
  cancelled_count integer not null default 0 check (cancelled_count>=0), dispute_count integer not null default 0 check (dispute_count>=0),
  avg_completion_seconds integer not null default 0 check (avg_completion_seconds>=0), updated_at timestamptz not null default now()
);

create table if not exists public.p2p_audit_logs (
  id uuid primary key default gen_random_uuid(), p2p_order_id uuid references public.p2p_orders(id) on delete set null,
  beneficiary_id uuid references public.p2p_beneficiaries(id) on delete set null, actor_id uuid references public.users(id) on delete set null,
  action text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

alter table public.p2p_beneficiary_applications enable row level security;
alter table public.p2p_beneficiaries enable row level security;
alter table public.p2p_beneficiary_accounts enable row level security;
alter table public.p2p_orders enable row level security;
alter table public.p2p_matches enable row level security;
alter table public.p2p_transaction_events enable row level security;
alter table public.p2p_disputes enable row level security;
alter table public.p2p_limits enable row level security;
alter table public.p2p_reputation enable row level security;
alter table public.p2p_audit_logs enable row level security;

grant select on public.p2p_beneficiary_applications,public.p2p_beneficiaries,public.p2p_beneficiary_accounts,public.p2p_orders,public.p2p_matches,public.p2p_transaction_events,public.p2p_disputes,public.p2p_limits,public.p2p_reputation to authenticated;

drop policy if exists "P2P candidates manage own applications" on public.p2p_beneficiary_applications;
create policy "P2P candidates manage own applications" on public.p2p_beneficiary_applications for select to authenticated using ((select auth.uid())=user_id or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role));
drop policy if exists "P2P beneficiaries view own or admin" on public.p2p_beneficiaries;
create policy "P2P beneficiaries view own or admin" on public.p2p_beneficiaries for select to authenticated using ((select auth.uid())=user_id or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role));
drop policy if exists "P2P accounts view owner or admin" on public.p2p_beneficiary_accounts;
drop policy if exists "P2P accounts view owner or admin" on public.p2p_beneficiary_accounts;
create policy "P2P accounts view owner buyer or admin" on public.p2p_beneficiary_accounts for select to authenticated using (exists(select 1 from public.p2p_beneficiaries b where b.id=p2p_beneficiary_accounts.beneficiary_id and (b.user_id=(select auth.uid()) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role))) or exists(select 1 from public.p2p_orders o where o.beneficiary_account_id=p2p_beneficiary_accounts.id and o.buyer_id=(select auth.uid())));
drop policy if exists "P2P orders view participants or admin" on public.p2p_orders;
drop policy if exists "P2P orders view participants or admin" on public.p2p_orders;
create policy "P2P orders view participants or admin" on public.p2p_orders for select to authenticated using (p2p_orders.buyer_id=(select auth.uid()) or exists(select 1 from public.p2p_beneficiaries b where b.id=p2p_orders.beneficiary_id and b.user_id=(select auth.uid())) or exists(select 1 from public.p2p_matches m join public.p2p_beneficiaries b on b.id=m.beneficiary_id where m.p2p_order_id=p2p_orders.id and b.user_id=(select auth.uid())) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role));
drop policy if exists "P2P matches view participant or admin" on public.p2p_matches;
drop policy if exists "P2P matches view participant or admin" on public.p2p_matches;
create policy "P2P matches view participant or admin" on public.p2p_matches for select to authenticated using (exists(select 1 from public.p2p_orders o where o.id=p2p_matches.p2p_order_id and (o.buyer_id=(select auth.uid()) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role))) or exists(select 1 from public.p2p_beneficiaries b where b.id=p2p_matches.beneficiary_id and b.user_id=(select auth.uid())));
drop policy if exists "P2P events view participant or admin" on public.p2p_transaction_events;
create policy "P2P events view participant or admin" on public.p2p_transaction_events for select to authenticated using (exists(select 1 from public.p2p_orders o where o.id=p2p_order_id and (o.buyer_id=(select auth.uid()) or exists(select 1 from public.p2p_beneficiaries b where b.id=o.beneficiary_id and b.user_id=(select auth.uid())) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role))));
drop policy if exists "P2P disputes view participants or admin" on public.p2p_disputes;
create policy "P2P disputes view participants or admin" on public.p2p_disputes for select to authenticated using (opened_by=(select auth.uid()) or exists(select 1 from public.p2p_orders o where o.id=p2p_order_id and (o.buyer_id=(select auth.uid()) or exists(select 1 from public.p2p_beneficiaries b where b.id=o.beneficiary_id and b.user_id=(select auth.uid())))) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role));
drop policy if exists "P2P reputation view authenticated" on public.p2p_reputation;
create policy "P2P reputation view authenticated" on public.p2p_reputation for select to authenticated using (true);
drop policy if exists "P2P limits owner or admin" on public.p2p_limits;
create policy "P2P limits owner or admin" on public.p2p_limits for select to authenticated using (exists(select 1 from public.p2p_beneficiaries b where b.id=beneficiary_id and (b.user_id=(select auth.uid()) or public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role))));
drop policy if exists "P2P audit view admin" on public.p2p_audit_logs;
create policy "P2P audit view admin" on public.p2p_audit_logs for select to authenticated using (public.is_root_admin((select auth.uid())) or public.has_role((select auth.uid()),'admin'::app_role));

-- As funções P2P são criadas/geridas no backend com SECURITY DEFINER e verificações explícitas de auth/role.
