-- QA: validar o formato completo do UUID do tópico antes de o converter.
-- Evita que tópicos malformados provoquem erros na avaliação da política RLS.
begin;

drop policy if exists "Participantes autorizados podem subscrever presença do chat"
  on realtime.messages;

create policy "Participantes autorizados podem subscrever presença do chat"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() ~ '^chat-presence:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
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
