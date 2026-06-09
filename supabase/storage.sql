-- Storage bucket for student document uploads
-- Run this in the Supabase SQL Editor ONCE after schema.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to documents bucket
CREATE POLICY "Students can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'student'
);

-- Allow public read access to documents (for preview)
CREATE POLICY "Anyone can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow students to update/delete their own uploads
CREATE POLICY "Students can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND
  owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'documents' AND
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND
  owner = auth.uid()
);

CREATE POLICY "Students can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND
  owner = auth.uid()
);

-- Officers and HOD can view all documents
CREATE POLICY "Officers and HOD can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('officer', 'hod')
);
