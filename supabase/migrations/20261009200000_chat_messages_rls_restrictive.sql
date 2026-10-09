-- Endurece a autorização do chat e impede novas mensagens em texto simples.
begin;

drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can update received messages" on public.messages;
drop policy if exists "Users can view their messages" on public.messages;
drop policy if exists "Participantes podem ler as suas mensagens" on public.messages;
drop policy if exists "Participante envia apenas para o outro participante" on public.messages;
drop policy if exists "Destinatário só marca as próprias mensagens como lidas" on public.messages;

create policy "Participantes podem ler as suas mensagens"
  on public.messages for select to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.user_id or auth.uid() = c.participant_id or auth.uid() = c.peer_user_id)
    )
  );

create policy "Participante envia apenas para o outro participante"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id is not null
    and sender_id <> receiver_id
    and conversation_id is not null
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          (auth.uid() = c.user_id and receiver_id in (c.participant_id, c.peer_user_id))
          or (auth.uid() = c.participant_id and receiver_id in (c.user_id, c.peer_user_id))
          or (auth.uid() = c.peer_user_id and receiver_id in (c.user_id, c.participant_id))
        )
    )
  );

create policy "Destinatário só marca as próprias mensagens como lidas"
  on public.messages for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

revoke all on public.messages from anon;
revoke insert, update, delete on public.messages from authenticated;
grant select, insert on public.messages to authenticated;
grant update (read) on public.messages to authenticated;

-- CHECK NOT VALID preserva mensagens históricas, mas exige cifragem em novas inserções
-- e em qualquer actualização de conteúdo de uma linha.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_content_must_be_encrypted'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_content_must_be_encrypted
      check (content like 'agrilink-e2ee:%') not valid;
  end if;
end $$;

commit;
