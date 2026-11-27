-- Autoriza canais privados de presença apenas aos participantes da conversa.
-- O tópico esperado tem o formato chat-presence:<conversation-uuid>.
begin;

drop policy if exists "Participantes autorizados podem subscrever presença do chat"
  on realtime.messages;

create policy "Participantes autorizados podem subscrever presença do chat"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() ~ '^chat-presence:[0-9a-fA-F-]{36}$'
    and exists (
      select 1
      from public.conversations c
      where c.id = substring(realtime.topic() from 15)::uuid
        and (
          auth.uid() = c.user_id
          or auth.uid() = c.participant_id
          or auth.uid() = c.peer_user_id
        )
    )
  );

commit;
