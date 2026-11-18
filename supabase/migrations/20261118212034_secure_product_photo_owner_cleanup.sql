-- Allow authenticated owners to clean up only their own product photo uploads.
-- This supports rollback when a multi-image product publication fails partway through.
CREATE POLICY "Product owners can delete images from their own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
