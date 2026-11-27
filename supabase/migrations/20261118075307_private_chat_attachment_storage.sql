-- Chat attachments must not be publicly readable or visible to every authenticated user.
-- Future paths use: <owner-user-id>/<conversation-id>/<opaque-file-name>.
-- The chat UI keeps uploads disabled until client-side file encryption is implemented.

begin;

update storage.buckets
set public = false
where id in ('chat-files', 'chatfiles');

drop policy if exists "Users can upload chat files" on storage.objects;
drop policy if exists "Users can view chat files" on storage.objects;
drop policy if exists "Users can delete own chat files" on storage.objects;
drop policy if exists "Users can upload chatfiles" on storage.objects;
drop policy if exists "Users can view chatfiles" on storage.objects;
drop policy if exists "Users can delete own chatfiles" on storage.objects;

create policy "Conversation participants can read private chat files"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('chat-files', 'chatfiles')
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[2]
      and auth.uid() in (c.user_id, c.participant_id, c.peer_user_id)
  )
);

-- Legacy attachments were stored as flat UUID filenames, without a conversation ID.
-- Keep them private and readable only by their original uploader; never guess the
-- conversation from the owner or expose them to every authenticated user.
create policy "Owners can read legacy flat chat files"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('chat-files', 'chatfiles')
  and array_length(storage.foldername(name), 1) is null
  and owner_id = auth.uid()::text
);

create policy "Conversation participants can upload private chat files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('chat-files', 'chatfiles')
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[2]
      and auth.uid() in (c.user_id, c.participant_id, c.peer_user_id)
  )
);

create policy "File owners can delete their private chat files"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('chat-files', 'chatfiles')
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[2]
      and auth.uid() in (c.user_id, c.participant_id, c.peer_user_id)
  )
);

commit;
