-- Regista apenas chaves públicas para cifragem ECDH do chat.
-- As chaves privadas ficam no IndexedDB de cada dispositivo e nunca são enviadas ao servidor.
create table if not exists public.chat_encryption_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key jsonb not null,
  key_version integer not null default 1 check (key_version = 1),
  updated_at timestamptz not null default now()
);

alter table public.chat_encryption_keys enable row level security;

drop policy if exists "Utilizadores autenticados podem consultar chaves públicas do chat"
  on public.chat_encryption_keys;
create policy "Utilizadores autenticados podem consultar chaves públicas do chat"
  on public.chat_encryption_keys
  for select to authenticated
  using (true);

drop policy if exists "Cada utilizador gere apenas a sua chave pública"
  on public.chat_encryption_keys;
create policy "Cada utilizador gere apenas a sua chave pública"
  on public.chat_encryption_keys
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Cada utilizador actualiza apenas a sua chave pública"
  on public.chat_encryption_keys;
create policy "Cada utilizador actualiza apenas a sua chave pública"
  on public.chat_encryption_keys
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.chat_encryption_keys from anon, public;
grant select, insert, update on public.chat_encryption_keys to authenticated;

comment on table public.chat_encryption_keys is
  'Chaves públicas ECDH para cifragem de mensagens no cliente. Nunca guardar chaves privadas nesta tabela.';
