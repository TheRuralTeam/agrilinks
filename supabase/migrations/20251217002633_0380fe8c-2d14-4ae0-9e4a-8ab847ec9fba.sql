-- Criar políticas RLS para o bucket chat-files
-- Permitir que usuários autenticados façam upload de arquivos
CREATE POLICY "Users can upload chat files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files' 
  AND auth.uid() IS NOT NULL
);

-- Permitir que usuários autenticados vejam arquivos do chat
CREATE POLICY "Users can view chat files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-files' 
  AND auth.uid() IS NOT NULL
);

-- Permitir que usuários deletem seus próprios arquivos
CREATE POLICY "Users can delete own chat files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Também para o bucket chatfiles (caso seja usado)
CREATE POLICY "Users can upload chatfiles"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chatfiles' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view chatfiles"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chatfiles' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete own chatfiles"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chatfiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);