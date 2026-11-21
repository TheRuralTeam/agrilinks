-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251022110852; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Criar políticas de segurança para o bucket avatars
-- Permitir que usuários autenticados façam upload de seus próprios avatares

-- Política para permitir upload (INSERT)
CREATE POLICY "Usuários podem fazer upload de seus avatares"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir atualização (UPDATE)
CREATE POLICY "Usuários podem atualizar seus avatares"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir visualização (SELECT) - público
CREATE POLICY "Avatares são publicamente acessíveis"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Política para permitir deletar (DELETE)
CREATE POLICY "Usuários podem deletar seus avatares"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
