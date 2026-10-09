-- Endurece a autorização das mensagens: remetente e destinatário têm de pertencer
-- à conversa; clientes só podem alterar o estado de leitura, nunca o conteúdo.
begin;

drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can update received messages" on public.messages;
drop policy if exists "Users can view their messages" on public.messages;

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

-- A política de actualização acima é adicionalmente limitada por privilégio SQL:
-- a API não pode alterar content, sender_id, receiver_id, conversation_id nem files.
commit;
