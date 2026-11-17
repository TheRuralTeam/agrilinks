-- Enforce product image constraints at the Storage boundary, not only in the browser.
-- Product photos remain public because approved marketplace listings need public images.
-- Uploads, however, are restricted to the authenticated owner's folder.

begin;

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'product-photos';

drop policy if exists "Usuários autenticados podem fazer upload de fotos" on storage.objects;

create policy "Product owners can upload images to their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
